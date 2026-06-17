import { Module } from '@nestjs/common';
import { SoporteService } from './soporte.service';
import { SoporteController } from './soporte.controller';
import { SoporteGateway } from './soporte.gateway';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [JwtModule.register({})],
  controllers: [SoporteController],
  providers: [SoporteService, SoporteGateway],
  exports: [SoporteService, SoporteGateway],
})
export class SoporteModule {}
