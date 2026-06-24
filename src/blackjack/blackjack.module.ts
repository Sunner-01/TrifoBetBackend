import { Module } from '@nestjs/common';
import { BlackjackService } from './blackjack.service';
import { BlackjackGateway } from './blackjack.gateway';
import { BlackjackController } from './blackjack.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') || '1h' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [BlackjackService, BlackjackGateway],
  controllers: [BlackjackController],
  exports: [BlackjackService],
})
export class BlackjackModule {}
