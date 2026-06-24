import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class SoporteService {
  private supabase;
  private readonly logger = new Logger(SoporteService.name);

  constructor(private configService: ConfigService) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  async createTicket(userId: number, asunto: string, categoria: string) {
    const { data, error } = await this.supabase
      .from('ticket_soporte')
      .insert([{ usuario_id: userId, asunto, categoria, estado: 'abierto' }])
      .select()
      .single();

    if (error) {
      this.logger.error(`Error creating ticket: ${error.message}`);
      throw error;
    }

    // Auto-crear el primer mensaje con el asunto
    await this.saveMessage(data.id, userId, 'usuario', asunto);

    return data;
  }

  async getUserTickets(userId: number) {
    const { data, error } = await this.supabase
      .from('ticket_soporte')
      .select('*')
      .eq('usuario_id', userId)
      .order('fecha_creacion', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getAllTickets() {
    const { data, error } = await this.supabase
      .from('ticket_soporte')
      .select('*, usuario:usuario_id(nombre, apellido1, correo)')
      .order('fecha_creacion', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getTicketMessages(ticketId: number) {
    const { data, error } = await this.supabase
      .from('ticket_soporte_mensaje')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('fecha_creacion', { ascending: true });

    if (error) throw error;
    return data;
  }

  async saveMessage(
    ticketId: number,
    userId: number,
    remitenteTipo: string,
    contenido: string,
    imagenUrl: string | null = null,
  ) {
    const { data, error } = await this.supabase
      .from('ticket_soporte_mensaje')
      .insert([
        {
          ticket_id: ticketId,
          usuario_id: userId,
          remitente_tipo: remitenteTipo,
          contenido,
          imagen_url: imagenUrl,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateTicketStatus(ticketId: number, estado: string) {
    const { data, error } = await this.supabase
      .from('ticket_soporte')
      .update({ estado })
      .eq('id', ticketId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUserRole(userId: number) {
    const { data, error } = await this.supabase
      .from('usuario')
      .select('rol_id')
      .eq('id', userId)
      .single();
    if (error) return 2; // Default to normal user if error
    return data.rol_id;
  }
}
