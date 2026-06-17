import { Module } from '@nestjs/common';
import { JuegosCasinoController } from './juegos-casino.controller';
import { JuegosCasinoService } from './juegos-casino.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [JuegosCasinoController],
  providers: [JuegosCasinoService],
})
export class JuegosCasinoModule {}
