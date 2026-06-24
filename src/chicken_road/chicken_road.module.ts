import { Module } from '@nestjs/common';
import { ChickenRoadService } from './chicken_road.service';
import { ChickenRoadGateway } from './chicken_road.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
    }),
  ],
  providers: [ChickenRoadService, ChickenRoadGateway],
})
export class ChickenRoadModule {}
