// src/pais/pais.controller.ts
import { Controller, Get } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Controller('pais')
export class PaisController {
  private supabase;

  constructor(private config: ConfigService) {
    this.supabase = createClient(
      this.config.get('SUPABASE_URL')!,
      this.config.get('SUPABASE_ANON_KEY')!,
    );
  }

  @Get()
  async getPaises() {
    const { data, error } = await this.supabase
      .from('pais')
      .select('codigo, nombre_es, codigo_telefonico')
      .eq('habilitado', true)
      .order('nombre_es');

    if (error) {
      return { error: error.message };
    }
    return data;
  }
}
