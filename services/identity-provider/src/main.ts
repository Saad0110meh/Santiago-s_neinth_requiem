import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// services/identity-provider/src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:8080';
  app.enableCors({
    // Trust the new Docker port and the local dev port
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  
  await app.listen(process.env.PORT || 3001);
}
bootstrap();