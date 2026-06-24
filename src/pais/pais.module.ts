// src/pais/pais.module.ts
import { Module } from '@nestjs/common';
import { PaisController } from './pais.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [PaisController],
})
export class PaisModule {}
