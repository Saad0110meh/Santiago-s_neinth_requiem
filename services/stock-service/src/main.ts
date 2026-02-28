import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Important for cross-container communication
  app.enableCors();
  
  await app.listen(3002);
  console.log('Stock Service is running on port 3002');
}
bootstrap();