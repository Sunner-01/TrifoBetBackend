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
import { TragamonedasService } from './tragamonedas.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class TragamonedasGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private tragamonedasService: TragamonedasService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')?.[1];

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('JWT_SECRET'),
      });
      console.log('JWT Payload completo:', JSON.stringify(payload));

      client.data.userId = payload.sub.toString();
      client.data.username = payload.username || 'Jugador';
      console.log(`Cliente Tragamonedas conectado: ${client.data.userId}`);
    } catch (error) {
      console.error('Error de autenticación en Tragamonedas:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente Tragamonedas desconectado: ${client.data.userId}`);
  }

  @SubscribeMessage('joinTragamonedas')
  async handleJoin(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    try {
      const balance = await this.tragamonedasService.getBalance(userId);
      client.emit('tragamonedasInit', {
        balance,
        username: client.data.username,
      });
    } catch (error) {
      client.emit('tragamonedasError', { message: error.message });
    }
  }

  @SubscribeMessage('spinTragamonedas')
  async handleSpin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { totalBet: number },
  ) {
    const userId = client.data.userId;
    if (!userId) return;

    try {
      const result = await this.tragamonedasService.spin(userId, data.totalBet);
      // Emit result to the specific client
      client.emit('tragamonedasResult', result);
    } catch (error) {
      client.emit('tragamonedasError', { message: error.message });
    }
  }
}
