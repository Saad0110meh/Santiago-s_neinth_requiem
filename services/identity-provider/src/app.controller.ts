import { Controller, Post, Body, HttpCode, Get } from '@nestjs/common'; // Added Get here
import { AppService } from './app.service';

@Controller() 
export class AppController {
  constructor(private readonly appService: AppService) {}

  // This is what the admin.html dashboard is looking for!
  @Get('health')
  async getHealth() {
    return this.appService.getHealth();
  }

  @Post('login') 
  @HttpCode(200)
  async login(@Body() body: { student_id: string }) {
    return this.appService.login(body.student_id);
  }
}