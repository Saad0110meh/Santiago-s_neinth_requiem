import { Injectable, UnauthorizedException, ServiceUnavailableException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Client } from 'pg';
import { createClient } from 'redis';

@Injectable()
export class AppService {
  private dbClient: Client;
  private redisClient;

  constructor(private jwtService: JwtService) {
    // Initialize Database Client
    this.dbClient = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    this.dbClient.connect().catch(err => console.error('Identity DB Connection Error:', err));

    // Initialize Redis Client for Rate Limiting
    this.redisClient = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
    this.redisClient.on('error', (err) => console.error('Identity Redis Error:', err));
    this.redisClient.connect();
  }

  async getHealth() {
    try {
      // Simple query to ensure DB is responsive
      await this.dbClient.query('SELECT 1');
      return { status: 'healthy', service: 'Identity Provider', db: 'connected' };
    } catch (error) {
      throw new ServiceUnavailableException('Database dependency is unreachable');
    }
  }

  async login(student_id: string, ip: string) {
    // 0. Rate Limiting Logic (3 attempts per minute)
    const key = `login_attempts:${ip}`;
    const attempts = await this.redisClient.incr(key);
    
    if (attempts === 1) {
      await this.redisClient.expire(key, 60); // Reset count after 60 seconds
    }

    if (attempts > 3) {
      throw new HttpException('Too many attempts', HttpStatus.TOO_MANY_REQUESTS);
    }

    // 1. Check if user exists in the PostgreSQL table
    const res = await this.dbClient.query(
      'SELECT * FROM users WHERE student_id = $1',
      [student_id],
    );

    if (res.rows.length === 0) {
      throw new UnauthorizedException('Wrong ID');
    }

    const user = res.rows[0];

    // 2. Generate the JWT
    const payload = { 
      sub: user.student_id, 
      role: user.role 
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}