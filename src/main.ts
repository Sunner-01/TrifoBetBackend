// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { SocketIOAdapter } from './socket-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS para peticiones HTTP normales
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Configurar el adaptador personalizado de Socket.IO con CORS
  app.useWebSocketAdapter(new SocketIOAdapter(app));

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`Backend + Socket.IO corriendo en http://localhost:${port}`);
  console.log('WebSocket Gateway listo para conexiones');
}
bootstrap();
