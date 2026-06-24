import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PlinkoService } from './plinko.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class PlinkoGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private plinkoService: PlinkoService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')?.[1];

      console.log('🎯 Plinko: Intento de conexión...');
      console.log(
        '🔑 Token en auth:',
        client.handshake.auth?.token ? 'SÍ' : 'NO',
      );
      console.log(
        '🔑 Token en headers:',
        client.handshake.headers?.authorization ? 'SÍ' : 'NO',
      );

      if (!token) {
        console.log('❌ Plinko: No hay token, rechazando conexión');
        client.disconnect();
        return;
      }

      console.log(`✅ Plinko: Token recibido: ${token.substring(0, 20)}...`);

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });

      client.data.userId = payload.sub.toString();
      client.data.username = payload.username || 'Jugador';

      console.log(`✅ Cliente Plinko conectado:`);
      console.log(`   - UserID: ${client.data.userId}`);
      console.log(`   - Username: ${client.data.username}`);
    } catch (error) {
      console.error('❌ Error de autenticación en Plinko:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente Plinko desconectado: ${client.data.userId}`);
  }

  @SubscribeMessage('joinPlinko')
  async handleJoin(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    console.log(`📥 Plinko: joinPlinko recibido de userId: ${userId}`);

    if (!userId) {
      console.log('❌ Plinko: No hay userId en el cliente');
      return;
    }

    try {
      const balance = await this.plinkoService.getBalance(userId);
      const username = client.data.username;

      console.log(`📤 Plinko: Enviando plinkoInit:`);
      console.log(`   - Balance: ${balance}`);
      console.log(`   - Username: ${username}`);

      client.emit('plinkoInit', {
        balance,
        username,
      });
    } catch (error) {
      console.error(`❌ Plinko: Error en joinPlinko:`, error.message);
      client.emit('plinkoError', { message: error.message });
    }
  }

  @SubscribeMessage('placeBet')
  async handleBet(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { betAmount: number },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    try {
      const result = await this.plinkoService.play(userId, data.betAmount);
      client.emit('plinkoResult', result);
    } catch (error) {
      client.emit('plinkoError', { message: error.message });
    }
  }
}
