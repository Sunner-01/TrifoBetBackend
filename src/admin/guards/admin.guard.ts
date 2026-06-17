// src/admin/guards/admin.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class AdminGuard implements CanActivate {
  private supabase;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticación requerido');
    }

    const token = authHeader.split(' ')[1];

    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    // Verificar que el usuario es administrador (rol_id = 1)
    const { data: usuario, error } = await this.supabase
      .from('usuario')
      .select('id, rol_id, habilitado')
      .eq('id', payload.sub)
      .single();

    if (error || !usuario) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!usuario.habilitado) {
      throw new ForbiddenException('Usuario suspendido');
    }

    if (usuario.rol_id !== 1) {
      throw new ForbiddenException('Acceso denegado: se requiere rol de administrador');
    }

    request.user = payload;
    return true;
  }
}
