import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type UserMasterRow = {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  last_seen: Date | null;
};

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(viewerId: number): Promise<UserMasterRow[]> {
    await this.databaseService.query(
      `UPDATE user_master SET last_seen = NOW() WHERE user_id = $1`,
      [viewerId],
    );

    const result = await this.databaseService.query<UserMasterRow>(
      `SELECT user_id, first_name, last_name, email, status, created_at, updated_at, last_seen
       FROM user_master
       WHERE status = 'active'
       ORDER BY user_id ASC`,
    );

    return result.rows;
  }
}
