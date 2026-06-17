// src/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminGuard } from './guards/admin.guard';
import { PersonalController } from './personal.controller';
import { PersonalService } from './personal.service';

import { VerificacionModule } from '../verificacion/verificacion.module';

@Module({
  imports: [
    VerificacionModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        return {
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: { expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d' },
        } as import('@nestjs/jwt').JwtModuleOptions;
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminController, PersonalController],
  providers: [AdminService, AdminGuard, PersonalService],
})
export class AdminModule {}
