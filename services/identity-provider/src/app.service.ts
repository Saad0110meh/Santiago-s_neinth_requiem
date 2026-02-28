import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Client } from 'pg';

@Injectable()
export class AppService {
  private dbClient: Client;

  constructor(private jwtService: JwtService) {
    // Initialize Database Client
    this.dbClient = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    this.dbClient.connect().catch(err => console.error('Identity DB Connection Error:', err));
  }

  async login(student_id: string) {
    // 1. Check if user exists in the PostgreSQL table
    const res = await this.dbClient.query(
      'SELECT * FROM users WHERE student_id = $1',
      [student_id],
    );

    if (res.rows.length === 0) {
      throw new UnauthorizedException('Invalid Student ID');
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