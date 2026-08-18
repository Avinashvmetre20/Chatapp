import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SignInDto } from './dto/sign-in.dto';

type UserMasterRow = {
  user_id: number;
  first_name: string;
  last_name: string;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(dto: CreateUserDto): Promise<UserMasterRow> {
    const result = await this.databaseService.query<UserMasterRow>(
      `INSERT INTO user_master (first_name, last_name, password)
       VALUES ($1, $2, $3)
       RETURNING user_id, first_name, last_name, created_at, updated_at`,
      [dto.firstName, dto.lastName, dto.password],
    );

    return result.rows[0];
  }

  async findAll(): Promise<UserMasterRow[]> {
    const result = await this.databaseService.query<UserMasterRow>(
      `SELECT user_id, first_name, last_name, created_at, updated_at
       FROM user_master
       ORDER BY user_id ASC`,
    );

    return result.rows;
  }

  async signIn(dto: SignInDto): Promise<UserMasterRow> {
    const result = await this.databaseService.query<UserMasterRow>(
      `SELECT user_id, first_name, last_name, created_at, updated_at
       FROM user_master
       WHERE first_name = $1 AND last_name = $2 AND password = $3
       LIMIT 1`,
      [dto.firstName, dto.lastName, dto.password],
    );

    if (!result.rows[0]) {
      throw new UnauthorizedException(
        'Invalid first name, last name, or password',
      );
    }

    return result.rows[0];
  }
}
