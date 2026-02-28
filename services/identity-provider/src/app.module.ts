import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Loads .env variables
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // Configures JWT globally
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'devsprint-super-secret-2026',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}