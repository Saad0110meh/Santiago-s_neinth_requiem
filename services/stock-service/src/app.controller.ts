import { Controller, Post, Body, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller() // <--- Remove 'stock' from here
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  async getHealth() {
    return this.appService.getHealth();
  }

  @Get('metrics')
  async getMetrics() {
    return this.appService.getMetrics();
  }

  // This handles http://stock-service:3002/stock/reduce
  @Post('stock/reduce')
  async reduceStock(@Body() body: { item_id: number, quantity: number, order_id?: string }) {
    return this.appService.checkAndReduceStock(body.item_id, body.quantity, body.order_id);
  }

  // This handles http://stock-service:3002/reduce (The Gateway's likely target)
  @Post('reduce')
  async reduce(@Body() body: { item_id: number, quantity: number, order_id?: string }) {
    return this.appService.checkAndReduceStock(body.item_id, body.quantity, body.order_id);
  }
}