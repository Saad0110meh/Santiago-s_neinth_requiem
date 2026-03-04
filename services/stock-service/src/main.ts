import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Use environment variable for CORS origin for consistency and security
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:8080';
  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  
  await app.listen(3002);
  console.log('Stock Service is running on port 3002');
}
bootstrap();