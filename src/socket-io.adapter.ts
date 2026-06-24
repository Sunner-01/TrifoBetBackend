// src/socket-io.adapter.ts
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { INestApplicationContext } from '@nestjs/common';

export class SocketIOAdapter extends IoAdapter {
  constructor(app: INestApplicationContext) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    console.log('🔌 SocketIOAdapter: Creando servidor IO con CORS *');
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*', // Permitir todos los orígenes
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    return server;
  }
}
