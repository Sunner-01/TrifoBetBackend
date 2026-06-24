import { Module } from '@nestjs/common';
import { PlinkoService } from './plinko.service';
import { PlinkoGateway } from './plinko.gateway';
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
  providers: [PlinkoService, PlinkoGateway],
  exports: [PlinkoService],
})
export class PlinkoModule {}
