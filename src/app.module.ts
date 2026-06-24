// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { PaisModule } from './pais/pais.module';
import { PerfilModule } from './perfil/perfil.module';
import { CloudinaryProvider } from './config/cloudinary.config';
import { BlackjackModule } from './blackjack/blackjack.module';
import { DeportesModule } from './deportes/deportes.module';
import { TransaccionesModule } from './transacciones/transacciones.module';
import { ChickenRoadModule } from './chicken_road/chicken_road.module';
import { NebulaModule } from './nebula/nebula.module';
import { TragamonedasModule } from './tragamonedas/tragamonedas.module';
import { PlinkoModule } from './plinko/plinko.module';
import { GeolocalizacionModule } from './geolocalizacion/geolocalizacion.module';
import { AdminModule } from './admin/admin.module';
import { ApuestasDeportivasModule } from './apuestas-deportivas/apuestas-deportivas.module';
import { VerificacionModule } from './verificacion/verificacion.module';
import { ChatModule } from './chat/chat.module';
import { RecargasModule } from './recargas/recargas.module';
import { RetirosModule } from './retiros/retiros.module';
import { JuegosCasinoModule } from './juegos-casino/juegos-casino.module';
import { SoporteModule } from './soporte/soporte.module';
import { ReportesModule } from './reportes/reportes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate limiting global: máximo 60 peticiones por minuto por IP
    ThrottlerModule.forRoot([
      {
        name: 'general',
        ttl: 60000, // 60 segundos
        limit: 60, // 60 peticiones por IP por minuto
      },
    ]),
    AuthModule,
    PaisModule,
    PerfilModule,
    BlackjackModule,
    DeportesModule,
    TransaccionesModule,
    ChickenRoadModule,
    NebulaModule,
    TragamonedasModule,
    PlinkoModule,
    GeolocalizacionModule,
    AdminModule,
    ApuestasDeportivasModule,
    VerificacionModule,
    ChatModule,
    RecargasModule,
    RetirosModule,
    JuegosCasinoModule,
    SoporteModule,
    ReportesModule,
  ],
  providers: [
    CloudinaryProvider,
    // Aplicar rate limiting a TODA la aplicación globalmente
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
