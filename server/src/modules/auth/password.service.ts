import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { compare, hash } from 'bcryptjs';

@Injectable()
export class PasswordService {
  private readonly saltRounds: number;

  constructor(private readonly configService: ConfigService) {
    this.saltRounds =
      this.configService.get<number>('auth.bcryptSaltRounds') ?? 12;
  }

  hash(password: string) {
    return hash(password, this.saltRounds);
  }

  compare(password: string, passwordHash: string) {
    return compare(password, passwordHash);
  }
}
