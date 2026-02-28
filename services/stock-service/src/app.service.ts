import { Injectable, BadRequestException } from '@nestjs/common';
import { Client } from 'pg';

@Injectable()
export class AppService {
  private dbClient: Client;

  constructor() {
    this.dbClient = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    this.dbClient.connect().catch(err => console.error('Stock DB Connection Error:', err));
  }

  async checkAndReduceStock(item_id: any, quantity: any) {
  // Force conversion to numbers to avoid "operator does not exist" errors
  const id = parseInt(item_id, 10);
  const qty = parseInt(quantity, 10);

  try {
    // 1. Check stock
    const res = await this.dbClient.query(
      'SELECT stock_quantity FROM menu_items WHERE id = $1',
      [id]
    );

    if (res.rows.length === 0) {
      console.error(`Item ID ${id} not found.`);
      throw new BadRequestException('Item not found');
    }

    const currentStock = res.rows[0].stock_quantity;

    if (currentStock < qty) {
      throw new BadRequestException('Insufficient stock');
    }

    // 2. Update stock
    await this.dbClient.query(
      'UPDATE menu_items SET stock_quantity = stock_quantity - $1 WHERE id = $2',
      [qty, id]
    );

    return { success: true, remaining_stock: currentStock - qty };
  } catch (error) {
    console.error('STOCK SERVICE DB ERROR:', error.message);
    throw error;
  }
}
}