import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // En producción debería restringirse
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private connectedUsers = new Map<string, { userId: number; username: string }>();

  constructor(
    private chatService: ChatService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) {
        this.logger.warn(`Cliente sin token intentó conectar: ${client.id}`);
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>('JWT_SECRET');
      const payload = this.jwtService.verify(token, { secret });
      
      const userId = payload.sub || payload.userId || payload.id_usuario || payload.id;
      const username = payload.nombre_usuario || payload.username || 'Usuario';

      this.connectedUsers.set(client.id, { userId, username });
      this.logger.log(`Cliente conectado: ${client.id} (User ID: ${userId}, Username: ${username})`);

      // Enviar historial de mensajes al usuario que acaba de conectar
      const recentMessages = await this.chatService.getRecentMessages();
      client.emit('chat_history', recentMessages);
    } catch (error) {
      this.logger.error(`Error de autenticación WebSocket: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedUsers.delete(client.id);
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('send_message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { text: string; replyTo?: any },
  ) {
    const user = this.connectedUsers.get(client.id);
    if (!user) {
      this.logger.warn(`Mensaje de cliente no autenticado: ${client.id}`);
      return;
    }

    if (!payload.text || payload.text.trim().length === 0) {
      return;
    }

    try {
      // Guardar en DB
      const savedMessage = await this.chatService.saveMessage(
        user.userId,
        user.username,
        payload.text.trim(),
        payload.replyTo,
      );

      // Emitir a TODOS los clientes conectados en este namespace
      this.server.emit('new_message', savedMessage);
    } catch (error) {
      this.logger.error(`Error procesando mensaje: ${error.message}`);
      client.emit('error', { message: 'No se pudo enviar el mensaje' });
    }
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: number; text: string },
  ) {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;

    if (!payload.text || payload.text.trim().length === 0 || !payload.messageId) {
      return;
    }

    try {
      const updatedMessage = await this.chatService.editMessage(
        payload.messageId,
        user.userId,
        payload.text.trim(),
      );

      this.server.emit('message_edited', updatedMessage);
    } catch (error) {
      this.logger.error(`Error editando mensaje: ${error.message}`);
      client.emit('error', { message: 'No se pudo editar el mensaje' });
    }
  }

  @SubscribeMessage('react_message')
  async handleReactMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: number; reaction: string },
  ) {
    const user = this.connectedUsers.get(client.id);
    if (!user) return;

    if (!payload.messageId || !payload.reaction) return;

    try {
      const updatedMessage = await this.chatService.reactMessage(
        payload.messageId,
        user.userId,
        payload.reaction,
      );

      if (updatedMessage) {
        this.server.emit('message_reacted', updatedMessage);
      }
    } catch (error) {
      this.logger.error(`Error reaccionando a mensaje: ${error.message}`);
      client.emit('error', { message: 'No se pudo reaccionar al mensaje' });
    }
  }
}
