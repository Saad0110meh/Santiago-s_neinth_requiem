import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// services/identity-provider/src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    // Trust the new Docker port and the local dev port
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:5173'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  
  await app.listen(3001);
}
bootstrap();