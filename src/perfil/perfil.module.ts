// src/perfil/perfil.module.ts
import { Module } from '@nestjs/common';
import { PerfilController } from './perfil.controller';
import { PerfilService } from './perfil.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule], // solo para leer el .env
  controllers: [PerfilController],
  providers: [PerfilService],
})
export class PerfilModule {}
