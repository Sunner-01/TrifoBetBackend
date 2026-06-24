// src/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminGuard } from './guards/admin.guard';
import { PersonalController } from './personal.controller';
import { PersonalService } from './personal.service';

import { VerificacionModule } from '../verificacion/verificacion.module';

// Nuevos servicios (SRP)
import { AdminUsersService } from './admin-users.service';
import { AdminApuestasService } from './admin-apuestas.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminVerificacionService } from './admin-verificacion.service';
import { AdminJuegosCasinoService } from './admin-juegos-casino.service';

@Module({
  imports: [
    VerificacionModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
          },
        } as import('@nestjs/jwt').JwtModuleOptions;
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminController, PersonalController],
  providers: [
    AdminGuard,
    PersonalService,
    AdminUsersService,
    AdminApuestasService,
    AdminDashboardService,
    AdminVerificacionService,
    AdminJuegosCasinoService,
  ],
})
export class AdminModule {}
