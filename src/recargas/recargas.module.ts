// src/recargas/recargas.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RecargasController } from './recargas.controller';
import { RecargasService } from './recargas.service';

@Module({
  imports: [ConfigModule],
  controllers: [RecargasController],
  providers: [RecargasService],
  exports: [RecargasService],
})
export class RecargasModule {}
