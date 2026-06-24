import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CrearSolicitudDto } from './dto/crear-solicitud.dto';
import { YapeNotificacionDto } from './dto/yape-notificacion.dto';
import { YapeParserService } from './yape-parser.service';
import { ImageUploadService } from '../common/providers/image-upload.service';

@Injectable()
export class RecargasService {
  private supabase: SupabaseClient;
  private readonly logger = new Logger(RecargasService.name);

  private readonly SIMILITUD_NOMBRE_MIN = 0.85;

  constructor(
    private readonly configService: ConfigService,
    private readonly yapeParser: YapeParserService,
    private readonly imageUploadService: ImageUploadService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  // ─── UTILIDADES ──────────────────────────────────────────────────────────────

  /** Genera un código alfanumérico único con prefijo TRIF- para identificar solicitudes. */
  private generarCodigoUnico(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo = 'TRIF-';
    for (let i = 0; i < 8; i++) {
      codigo += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return codigo;
  }

  // ─── ENDPOINTS DE USUARIO ────────────────────────────────────────────────────


  async crearSolicitud(userId: number, dto: CrearSolicitudDto) {
    if (!dto.aceptaTitular) {
      throw new BadRequestException(
        'Debes confirmar que el pago será realizado desde una cuenta a tu nombre.',
      );
    }

    // Obtener datos del usuario
    const { data: usuario, error: userError } = await this.supabase
      .from('usuario')
      .select('nombre, apellido1, apellido2, verificado, saldo')
      .eq('id', userId)
      .single();

    if (userError || !usuario)
      throw new NotFoundException('Usuario no encontrado');

    // Generar código único (con reintentos para evitar colisiones)
    let codigoUnico = '';
    let intentos = 0;
    while (intentos < 5) {
      const candidato = this.generarCodigoUnico();
      const { data: existe } = await this.supabase
        .from('solicitud_recarga')
        .select('id')
        .eq('codigo_unico', candidato)
        .maybeSingle();
      if (!existe) {
        codigoUnico = candidato;
        break;
      }
      intentos++;
    }
    if (!codigoUnico)
      throw new BadRequestException(
        'Error al generar código único. Intenta de nuevo.',
      );

    const { data, error } = await this.supabase
      .from('solicitud_recarga')
      .insert({
        usuario_id: userId,
        monto: dto.monto,
        codigo_unico: codigoUnico,
        estado: 'pendiente',
        acepta_titular: true,
        nombre_titular:
          `${usuario.nombre} ${usuario.apellido1} ${usuario.apellido2 || ''}`.trim(),
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Error al crear solicitud: ${error.message}`);
      throw new BadRequestException('Error al crear la solicitud de recarga.');
    }

    this.logger.log(
      `Solicitud creada: ${codigoUnico} - Usuario ${userId} - Monto ${dto.monto}`,
    );

    return {
      mensaje:
        'Solicitud creada correctamente. Realiza el pago y sube tu comprobante.',
      solicitud: data,
    };
  }

  async subirComprobante(
    userId: number,
    solicitudId: number,
    file: Express.Multer.File,
  ) {
    // Verificar que la solicitud pertenece al usuario y está pendiente
    const { data: solicitud, error } = await this.supabase
      .from('solicitud_recarga')
      .select('*')
      .eq('id', solicitudId)
      .eq('usuario_id', userId)
      .single();

    if (error || !solicitud)
      throw new NotFoundException('Solicitud no encontrada.');
    if (solicitud.estado !== 'pendiente')
      throw new BadRequestException(
        `Esta solicitud ya está ${solicitud.estado}.`,
      );

    // Subir imagen a través del servicio abstraído (DIP)
    const folderPath = `trifobet/recargas/usuario_${userId}`;
    const urlComprobante = await this.imageUploadService.uploadImage(file.buffer, folderPath);

    await this.supabase
      .from('solicitud_recarga')
      .update({
        url_comprobante: urlComprobante,
        fecha_comprobante: new Date().toISOString(),
      })
      .eq('id', solicitudId);

    this.logger.log(`Comprobante subido para solicitud ${solicitudId}`);

    return {
      mensaje:
        'Comprobante subido correctamente. Tu solicitud está en revisión.',
      urlComprobante,
    };
  }

  async misSolicitudes(userId: number) {
    const { data, error } = await this.supabase
      .from('solicitud_recarga')
      .select('*')
      .eq('usuario_id', userId)
      .order('fecha_creacion', { ascending: false })
      .limit(20);

    if (error) throw new BadRequestException('Error al obtener solicitudes.');
    return data || [];
  }

  // ─── ENDPOINT PARA APP FLUTTER ───────────────────────────────────────────────

  async recibirNotificacionYape(dto: YapeNotificacionDto, apiKey: string) {
    const expectedKey = this.configService.get<string>('YAPE_API_KEY');
    if (!expectedKey || apiKey !== expectedKey) {
      throw new UnauthorizedException('API Key inválida.');
    }

    // Delegar el parseo al servicio especializado (SRP)
    const { nombre, monto } = this.yapeParser.parse(dto.textoRaw);
    const fechaHoraNotif = dto.fechaHora ? new Date(dto.fechaHora) : new Date();

    // Guardar la notificación cruda
    const { data: notif } = await this.supabase
      .from('yape_notificacion')
      .insert({
        texto_raw: dto.textoRaw,
        nombre,
        monto,
        fecha_hora: fechaHoraNotif.toISOString(),
        procesada: false,
      })
      .select()
      .single();

    this.logger.log(
      `Notificación Yape recibida: nombre="${nombre}" monto=${monto}`,
    );

    // Intentar matching automático si tenemos nombre y monto
    if (nombre && monto) {
      await this.intentarMatchingAutomatico(
        notif.id,
        nombre,
        monto,
        fechaHoraNotif,
      );
    }

    return { recibido: true, nombre, monto };
  }

  private async intentarMatchingAutomatico(
    notifId: number,
    nombreYape: string,
    montoYape: number,
    fechaYape: Date,
  ) {
    // Buscar solicitudes pendientes con el mismo monto exacto
    // y creadas dentro de la ventana de tiempo (no más de 2 horas antes)
    const ventanaInicio = new Date(
      fechaYape.getTime() - 2 * 60 * 60 * 1000,
    ).toISOString();

    const { data: solicitudes } = await this.supabase
      .from('solicitud_recarga')
      .select('*')
      .eq('estado', 'pendiente')
      .eq('monto', montoYape)
      .gte('fecha_creacion', ventanaInicio)
      .order('fecha_creacion', { ascending: false });

    if (!solicitudes || solicitudes.length === 0) {
      this.logger.log(`No hay solicitudes pendientes para monto ${montoYape}`);
      return;
    }

    // Evaluar el mejor match por similitud de nombre
    let mejorMatch: { solicitud: any; score: number } | null = null;

    for (const sol of solicitudes) {
      const nombreSolicitud = sol.nombre_titular || '';
      const score = this.yapeParser.similitud(nombreYape, nombreSolicitud);

      this.logger.log(
        `Comparando "${nombreYape}" vs "${nombreSolicitud}" → score: ${(score * 100).toFixed(1)}%`,
      );

      if (score >= this.SIMILITUD_NOMBRE_MIN) {
        if (!mejorMatch || score > mejorMatch.score) {
          mejorMatch = { solicitud: sol, score };
        }
      }
    }

    if (!mejorMatch) {
      this.logger.log(
        'Ninguna solicitud superó el umbral de similitud de nombre.',
      );
      // Marcar notificación como procesada sin match
      await this.supabase
        .from('yape_notificacion')
        .update({ procesada: true })
        .eq('id', notifId);
      return;
    }

    const sol = mejorMatch.solicitud;

    // Match exitoso → aprobar automáticamente
    await this.aprobarSolicitud(sol.id, null, true, {
      notifId,
      matchScore: mejorMatch.score,
      nombreYape,
      montoYape,
      fechaYape: fechaYape.toISOString(),
    });

    // Marcar notificación como procesada y enlazada
    await this.supabase
      .from('yape_notificacion')
      .update({ procesada: true, solicitud_id: sol.id })
      .eq('id', notifId);

    this.logger.log(
      `✅ Match automático exitoso: Solicitud ${sol.codigo_unico} - Score: ${(mejorMatch.score * 100).toFixed(1)}%`,
    );
  }

  // ─── LÓGICA DE APROBACIÓN ────────────────────────────────────────────────────

  private async aprobarSolicitud(
    solicitudId: number,
    adminId: number | null,
    esAutomatico: boolean,
    datosMatch?: any,
  ) {
    const { data: sol } = await this.supabase
      .from('solicitud_recarga')
      .select('*')
      .eq('id', solicitudId)
      .single();

    if (!sol) throw new NotFoundException('Solicitud no encontrada.');
    if (sol.estado !== 'pendiente')
      throw new BadRequestException('La solicitud ya fue procesada.');

    // Actualizar la solicitud
    await this.supabase
      .from('solicitud_recarga')
      .update({
        estado: 'aprobado',
        procesado_auto: esAutomatico,
        aprobado_por: adminId,
        fecha_procesado: new Date().toISOString(),
        yape_nombre_pagador: datosMatch?.nombreYape,
        yape_monto: datosMatch?.montoYape,
        yape_fecha: datosMatch?.fechaYape,
        match_score: datosMatch?.matchScore
          ? Math.round(datosMatch.matchScore * 100)
          : null,
      })
      .eq('id', solicitudId);

    // Abonar saldo al usuario
    const { data: usuario } = await this.supabase
      .from('usuario')
      .select('saldo')
      .eq('id', sol.usuario_id)
      .single();

    const nuevoSaldo =
      parseFloat(usuario?.saldo || '0') + parseFloat(sol.monto);

    await this.supabase
      .from('usuario')
      .update({ saldo: nuevoSaldo })
      .eq('id', sol.usuario_id);

    // Registrar en la tabla de transacciones
    await this.supabase.from('transaccion').insert({
      usuario_id: sol.usuario_id,
      tipo: 'deposito',
      monto: sol.monto,
      estado: 'aprobado',
      numero_operacion: sol.codigo_unico,
      datos_pago: {
        metodo: 'yape_qr',
        solicitud_recarga_id: solicitudId,
        automatico: esAutomatico,
      },
      fecha_creacion: new Date().toISOString(),
      fecha_procesado: new Date().toISOString(),
    });

    this.logger.log(
      `💰 Saldo abonado: Usuario ${sol.usuario_id} - Monto ${sol.monto} - Nuevo saldo: ${nuevoSaldo}`,
    );
  }

  // ─── ENDPOINTS ADMIN ─────────────────────────────────────────────────────────

  async listarSolicitudes(params: {
    page?: number;
    limit?: number;
    estado?: string;
    busqueda?: string;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(50, params.limit || 20);
    const offset = (page - 1) * limit;

    let query = this.supabase
      .from('solicitud_recarga')
      .select(
        `*, usuario:usuario_id(id, nombre, apellido1, correo, verificado)`,
        { count: 'exact' },
      )
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.estado && params.estado !== 'todos') {
      query = query.eq('estado', params.estado);
    }

    if (params.busqueda) {
      query = query.or(
        `codigo_unico.ilike.%${params.busqueda}%,nombre_titular.ilike.%${params.busqueda}%`,
      );
    }

    const { data, count, error } = await query;

    if (error) throw new BadRequestException('Error al listar solicitudes.');

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    };
  }

  async aprobarManual(solicitudId: number, adminId: number, notas?: string) {
    await this.aprobarSolicitud(solicitudId, adminId, false);

    if (notas) {
      await this.supabase
        .from('solicitud_recarga')
        .update({ notas_admin: notas })
        .eq('id', solicitudId);
    }

    return { mensaje: 'Solicitud aprobada y saldo abonado correctamente.' };
  }

  async rechazarManual(solicitudId: number, adminId: number, notas: string) {
    const { data: sol } = await this.supabase
      .from('solicitud_recarga')
      .select('estado')
      .eq('id', solicitudId)
      .single();

    if (!sol) throw new NotFoundException('Solicitud no encontrada.');
    if (sol.estado !== 'pendiente')
      throw new BadRequestException('La solicitud ya fue procesada.');

    await this.supabase
      .from('solicitud_recarga')
      .update({
        estado: 'rechazado',
        aprobado_por: adminId,
        notas_admin: notas,
        fecha_procesado: new Date().toISOString(),
      })
      .eq('id', solicitudId);

    return { mensaje: 'Solicitud rechazada.' };
  }

  async estadisticasAdmin() {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const [pendientes, aprobadas, rechazadas, totalHoy, ultimaNotif] =
      await Promise.all([
        this.supabase
          .from('solicitud_recarga')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'pendiente'),
        this.supabase
          .from('solicitud_recarga')
          .select('monto')
          .eq('estado', 'aprobado')
          .gte('fecha_procesado', hoy.toISOString()),
        this.supabase
          .from('solicitud_recarga')
          .select('id', { count: 'exact', head: true })
          .eq('estado', 'rechazado')
          .gte('fecha_creacion', hoy.toISOString()),
        this.supabase
          .from('solicitud_recarga')
          .select('monto')
          .eq('estado', 'aprobado')
          .gte('fecha_procesado', hoy.toISOString()),
        this.supabase
          .from('yape_notificacion')
          .select('*')
          .order('fecha_recibida', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const montoAprobadoHoy = (aprobadas.data || []).reduce(
      (acc, s) => acc + parseFloat(s.monto),
      0,
    );

    return {
      pendientes: pendientes.count || 0,
      aprobadas: (aprobadas.data || []).length,
      rechazadas: rechazadas.count || 0,
      montoAprobadoHoy,
      ultimaNotificacionYape: ultimaNotif.data,
    };
  }

  async obtenerUltimasNotificaciones(limit = 10) {
    const { data } = await this.supabase
      .from('yape_notificacion')
      .select('*')
      .order('fecha_recibida', { ascending: false })
      .limit(limit);
    return data || [];
  }
}
