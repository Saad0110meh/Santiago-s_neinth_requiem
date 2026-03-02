import { Injectable, BadRequestException, ServiceUnavailableException, NotFoundException } from '@nestjs/common';
import { Client } from 'pg';

@Injectable()
export class AppService {
  private dbClient: Client;

  // Metrics Storage
  private metrics = {
    total_orders: 0,
    failures: 0,
    total_latency: 0,
  };

  constructor() {
    this.dbClient = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    this.dbClient.connect()
      .then(() => {
        // Create Idempotency Table
        return this.dbClient.query(`
          CREATE TABLE IF NOT EXISTS processed_orders (
            order_id VARCHAR(255) PRIMARY KEY,
            created_at TIMESTAMP DEFAULT NOW()
          );
        `);
      })
      .catch(err => console.error('Stock DB Connection Error:', err));
  }

  async getHealth() {
    try {
      await this.dbClient.query('SELECT 1');
      return { status: 'healthy', service: 'Stock Service', db: 'connected' };
    } catch (error) {
      throw new ServiceUnavailableException('Database dependency is unreachable');
    }
  }

  async getMetrics() {
    const avg_latency = this.metrics.total_orders > 0 
      ? this.metrics.total_latency / this.metrics.total_orders 
      : 0;

    return {
      total_orders: this.metrics.total_orders,
      failures: this.metrics.failures,
      average_latency_ms: parseFloat(avg_latency.toFixed(2)),
    };
  }

  async checkAndReduceStock(item_id: any, quantity: any, order_id?: string) {
    const start = Date.now(); // Start timer for latency tracking
    // Force conversion to numbers to avoid "operator does not exist" errors
    const id = parseInt(item_id, 10);
    const qty = parseInt(quantity, 10);

    // 1. Idempotency Check: If order already processed, return success immediately
    if (order_id) {
      const check = await this.dbClient.query('SELECT 1 FROM processed_orders WHERE order_id = $1', [order_id]);
      if ((check.rowCount ?? 0) > 0) {
        const stock = await this.dbClient.query('SELECT stock_quantity FROM menu_items WHERE id = $1', [id]);
        return { success: true, remaining_stock: stock.rows[0]?.stock_quantity, idempotent: true };
      }
    }

    try {
      await this.dbClient.query('BEGIN');

      // ATOMIC UPDATE: Decrement only if stock >= quantity
      const res = await this.dbClient.query(
        'UPDATE menu_items SET stock_quantity = stock_quantity - $1 WHERE id = $2 AND stock_quantity >= $1 RETURNING stock_quantity',
        [qty, id]
      );

      if (res.rowCount === 0) {
        await this.dbClient.query('ROLLBACK');
        // If update failed, check if item exists to give specific error
        const checkRes = await this.dbClient.query('SELECT 1 FROM menu_items WHERE id = $1', [id]);

        if (checkRes.rowCount === 0) {
          throw new NotFoundException('Item not found');
        }
        throw new BadRequestException('Insufficient stock');
      }

      // 2. Record Transaction
      if (order_id) {
        await this.dbClient.query('INSERT INTO processed_orders (order_id) VALUES ($1)', [order_id]);
      }

      await this.dbClient.query('COMMIT');
      this.updateMetrics(true, Date.now() - start);
      return { success: true, remaining_stock: res.rows[0].stock_quantity };
    } catch (error) {
      await this.dbClient.query('ROLLBACK');
      this.updateMetrics(false, Date.now() - start);
      console.error('STOCK SERVICE DB ERROR:', error.message);
      throw error;
    }
  }

  private updateMetrics(success: boolean, latency: number) {
    this.metrics.total_orders++;
    this.metrics.total_latency += latency;
    if (!success) this.metrics.failures++;
  }
}