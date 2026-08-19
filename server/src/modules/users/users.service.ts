import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from './dto/create-user.dto';

export type PublicUser = {
  user_id: number;
  first_name: string;
  last_name: string;
  email?: string;
  created_at: Date;
  updated_at: Date;
  last_seen: Date | null;
};

type AuthAccountRow = PublicUser & {
  password_hash: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(dto: CreateUserDto): Promise<PublicUser> {
    const passwordHash = await hash(dto.password, 12);
    const email = dto.email.trim().toLowerCase();

    try {
      return await this.databaseService.transaction(async (query) => {
        const result = await query<PublicUser>(
          `INSERT INTO user_master (
             first_name, last_name, email, status, last_seen, created_at, updated_at
           )
           VALUES ($1, $2, $3, 'active', NOW(), NOW(), NOW())
           RETURNING user_id, first_name, last_name, email, created_at, updated_at, last_seen`,
          [dto.firstName, dto.lastName, email],
        );

        const user = result.rows[0];

        await query(
          `INSERT INTO user_credentials (
             user_id, password_hash, password_changed_at, created_at, updated_at
           )
           VALUES ($1, $2, NOW(), NOW(), NOW())`,
          [user.user_id, passwordHash],
        );

        return user;
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  async findAll(viewerId?: number): Promise<PublicUser[]> {
    if (viewerId) {
      await this.heartbeat(viewerId);
    }

    const result = await this.databaseService.query<PublicUser>(
      `SELECT user_id, first_name, last_name, email, created_at, updated_at, last_seen
       FROM user_master
       ORDER BY user_id ASC`,
    );

    return result.rows;
  }

  async findById(userId: number): Promise<PublicUser> {
    const result = await this.databaseService.query<PublicUser>(
      `SELECT user_id, first_name, last_name, email, created_at, updated_at, last_seen
       FROM user_master
       WHERE user_id = $1`,
      [userId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return result.rows[0];
  }

  async findByEmailWithPassword(email: string): Promise<AuthAccountRow | null> {
    const result = await this.databaseService.query<AuthAccountRow>(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.created_at, u.updated_at,
              u.last_seen, c.password_hash
       FROM user_master u
       INNER JOIN user_credentials c ON c.user_id = u.user_id
       WHERE LOWER(u.email) = $1`,
      [email.trim().toLowerCase()],
    );

    return result.rows[0] ?? null;
  }

  async heartbeat(userId: number): Promise<PublicUser> {
    const result = await this.databaseService.query<PublicUser>(
      `UPDATE user_master
       SET last_seen = NOW()
       WHERE user_id = $1
       RETURNING user_id, first_name, last_name, email, created_at, updated_at, last_seen`,
      [userId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    await this.databaseService.query(
      `UPDATE chat_master
       SET status = 'delivered'
       WHERE receiver_id = $1
         AND status = 'sent'`,
      [userId],
    );

    return result.rows[0];
  }

  private isUniqueViolation(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    );
  }
}
