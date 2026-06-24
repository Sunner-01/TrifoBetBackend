import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SoporteService } from './soporte.service';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/soporte',
})
export class SoporteGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SoporteGateway.name);

  constructor(
    private readonly soporteService: SoporteService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth.token?.split(' ')[1] ||
        client.handshake.headers.authorization?.split(' ')[1];
      if (!token) throw new Error('No token provided');

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const userId =
        payload.sub || payload.userId || payload.id_usuario || payload.id;
      client.data.user = { userId };
      this.logger.log(`Client connected: ${client.id} (User: ${userId})`);
    } catch (error) {
      this.logger.error(`Connection failed: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinTicket')
  handleJoinTicket(
    @MessageBody() data: { ticketId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `ticket_${data.ticketId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} joined room ${room}`);
    return { event: 'joined', data: room };
  }

  @SubscribeMessage('leaveTicket')
  handleLeaveTicket(
    @MessageBody() data: { ticketId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `ticket_${data.ticketId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room ${room}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody()
    data: {
      ticketId: number;
      contenido: string;
      imagenUrl?: string;
      remitenteTipo?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const user = client.data.user;

    try {
      const remitenteTipo = data.remitenteTipo || 'usuario';
      const savedMessage = await this.soporteService.saveMessage(
        data.ticketId,
        user.userId,
        remitenteTipo,
        data.contenido,
        data.imagenUrl,
      );

      const room = `ticket_${data.ticketId}`;
      this.server.to(room).emit('newMessage', savedMessage);

      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error sending message: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }
}
