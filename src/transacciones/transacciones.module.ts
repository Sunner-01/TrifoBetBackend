// src/transacciones/transacciones.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TransaccionesController } from './transacciones.controller';
import { TransaccionesService } from './transacciones.service';
import { DepositosService } from './depositos.service';
import { RetirosService } from './retiros.service';

@Module({
  imports: [ConfigModule],
  controllers: [TransaccionesController],
  providers: [TransaccionesService, DepositosService, RetirosService],
  exports: [TransaccionesService],
})
export class TransaccionesModule {}
