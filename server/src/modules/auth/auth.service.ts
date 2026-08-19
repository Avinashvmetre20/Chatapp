import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import type { JwtPayload } from '../../common/types/auth-user';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService, type PublicUser } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

export type AuthResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: PublicUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: CreateUserDto): Promise<AuthResponse> {
    const user = await this.usersService.create(dto);
    return this.issueSession(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const account = await this.usersService.findByEmailWithPassword(dto.email);
    const passwordMatches = account
      ? await compare(dto.password, account.password_hash)
      : false;

    if (!account || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const user = await this.usersService.heartbeat(account.user_id);
    return this.issueSession(user);
  }

  async me(userId: number): Promise<PublicUser> {
    return this.usersService.findById(userId);
  }

  private issueSession(user: PublicUser): AuthResponse {
    const payload: JwtPayload = {
      sub: user.user_id,
      email: user.email,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('jwt.expiresIn') ?? '7d',
      user,
    };
  }
}
