import {
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NebulaService } from './nebula.service';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class NebulaGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private nebulaService: NebulaService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')?.[1];

      console.log(
        '🔑 NEBULA - Token recibido:',
        token ? token.substring(0, 20) + '...' : 'NO TOKEN',
      );

      if (!token) {
        console.log('❌ NEBULA - Sin token, desconectando cliente');
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token);
      client.data.userId = decoded.sub.toString();
      console.log(
        '✅ NEBULA - Cliente conectado. UserId:',
        client.data.userId,
        'Username:',
        decoded.username,
      );
    } catch (error) {
      console.log('❌ NEBULA - Error verificando token:', error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`🚀 Cliente Nebula desconectado: ${client.data.userId}`);
    if (client.data.userId) {
      this.nebulaService.handleDisconnect(client.data.userId);
    }
  }

  @SubscribeMessage('joinNebulaGame')
  async handleJoin(@ConnectedSocket() client: Socket) {
    console.log('📨 NEBULA - Evento joinNebulaGame recibido');
    const userId = client.data.userId;
    console.log('📨 NEBULA - UserId extraído:', userId);

    if (!userId) {
      console.log('❌ NEBULA - No hay userId, abortando');
      return;
    }

    const state = await this.nebulaService.initGame(userId);
    console.log('📨 NEBULA - Emitiendo nebulaGameState:', state);
    client.emit('nebulaGameState', state);
  }

  @SubscribeMessage('placeNebulaBet')
  async handleBet(
    @MessageBody() data: { amount: number },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    try {
      const result = await this.nebulaService.placeBet(userId, data.amount);
      client.emit('nebulaBetAccepted', result);
    } catch (error) {
      client.emit('nebulaError', { message: error.message });
    }
  }

  @SubscribeMessage('cancelNebulaBet')
  async handleCancel(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    try {
      const result = await this.nebulaService.cancelBet(userId);
      client.emit('nebulaBetCancelled', result);
    } catch (error) {
      client.emit('nebulaError', { message: error.message });
    }
  }

  @SubscribeMessage('startNebulaGame')
  async handleStart(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    try {
      // Pass client to service so it can emit 'nebulaGameCrashed' later
      const result = await this.nebulaService.startGame(userId, client);
      client.emit('nebulaGameStarted', result);
    } catch (error) {
      client.emit('nebulaError', { message: error.message });
    }
  }

  @SubscribeMessage('cashoutNebula')
  async handleCashout(
    @MessageBody() data: { multiplier: number },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId;
    try {
      const result = await this.nebulaService.cashout(userId, data.multiplier);
      client.emit('nebulaCashoutSuccess', result);
    } catch (error) {
      client.emit('nebulaError', { message: error.message });
    }
  }
}
