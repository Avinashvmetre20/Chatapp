import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SignInDto } from './dto/sign-in.dto';

type UserMasterRow = {
  user_id: number;
  first_name: string;
  last_name: string;
  created_at: Date;
  updated_at: Date;
  last_seen: Date | null;
};

type SignInRow = UserMasterRow & {
  password_hash: string;
};

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(dto: CreateUserDto): Promise<UserMasterRow> {
    const passwordHash = await hash(dto.password, 12);
    const email = dto.email.trim().toLowerCase();

    try {
      return await this.databaseService.transaction(async (query) => {
        const result = await query<UserMasterRow>(
          `INSERT INTO user_master (
             first_name, last_name, email, status, last_seen, created_at, updated_at
           )
           VALUES ($1, $2, $3, 'active', NOW(), NOW(), NOW())
           RETURNING user_id, first_name, last_name, created_at, updated_at, last_seen`,
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

  async findAll(viewerId?: number): Promise<UserMasterRow[]> {
    if (viewerId) {
      await this.heartbeat(viewerId);
    }

    const result = await this.databaseService.query<UserMasterRow>(
      `SELECT user_id, first_name, last_name, created_at, updated_at, last_seen
       FROM user_master
       ORDER BY user_id ASC`,
    );

    return result.rows;
  }

  async signIn(dto: SignInDto): Promise<UserMasterRow> {
    const result = await this.databaseService.query<SignInRow>(
      `SELECT u.user_id, u.first_name, u.last_name, u.created_at, u.updated_at,
              u.last_seen, c.password_hash
       FROM user_master u
       INNER JOIN user_credentials c ON c.user_id = u.user_id
       WHERE u.first_name = $1 AND u.last_name = $2`,
      [dto.firstName, dto.lastName],
    );

    const user = result.rows[0];
    const passwordMatches = user
      ? await compare(dto.password, user.password_hash)
      : false;

    if (!user || !passwordMatches) {
      throw new UnauthorizedException(
        'Invalid first name, last name, or password',
      );
    }

    const updated = await this.databaseService.query<UserMasterRow>(
      `UPDATE user_master
       SET last_seen = NOW(), updated_at = NOW()
       WHERE user_id = $1
       RETURNING user_id, first_name, last_name, created_at, updated_at, last_seen`,
      [user.user_id],
    );

    return updated.rows[0];
  }

  async heartbeat(userId: number): Promise<UserMasterRow> {
    const result = await this.databaseService.query<UserMasterRow>(
      `UPDATE user_master
       SET last_seen = NOW()
       WHERE user_id = $1
       RETURNING user_id, first_name, last_name, created_at, updated_at, last_seen`,
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
