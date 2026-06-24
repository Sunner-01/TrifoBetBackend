import { Module } from '@nestjs/common';
import { TragamonedasService } from './tragamonedas.service';
import { TragamonedasGateway } from './tragamonedas.gateway';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [TragamonedasService, TragamonedasGateway],
  exports: [TragamonedasService],
})
export class TragamonedasModule {}
