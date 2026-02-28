import { Controller, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';

@Controller() // <--- Remove 'stock' from here
export class AppController {
  constructor(private readonly appService: AppService) {}

  // This handles http://stock-service:3002/stock/reduce
  @Post('stock/reduce')
  async reduceStock(@Body() body: { item_id: number, quantity: number }) {
    return this.appService.checkAndReduceStock(body.item_id, body.quantity);
  }

  // This handles http://stock-service:3002/reduce (The Gateway's likely target)
  @Post('reduce')
  async reduce(@Body() body: { item_id: number, quantity: number }) {
    return this.appService.checkAndReduceStock(body.item_id, body.quantity);
  }
}