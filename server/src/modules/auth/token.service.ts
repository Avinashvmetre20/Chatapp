import { createHash, randomBytes, randomUUID } from 'crypto';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign, verify, type SignOptions } from 'jsonwebtoken';

export type AccessTokenPayload = {
  sub: number;
  sessionId: string;
  type: 'access';
};

@Injectable()
export class TokenService {
  private readonly jwtSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor(private readonly configService: ConfigService) {
    this.jwtSecret = this.configService.get<string>('auth.jwtSecret') ?? '';
    this.accessExpiresIn =
      this.configService.get<string>('auth.accessTokenExpiresIn') ?? '15m';
    this.refreshExpiresIn =
      this.configService.get<string>('auth.refreshTokenExpiresIn') ?? '7d';

    if (!this.jwtSecret || this.jwtSecret.length < 32) {
      throw new InternalServerErrorException('JWT_SECRET is not configured');
    }
  }

  createAccessToken(userId: number, sessionId: string) {
    return sign(
      { sub: userId, sessionId, type: 'access' } satisfies AccessTokenPayload,
      this.jwtSecret,
      { expiresIn: this.accessExpiresIn } as SignOptions,
    );
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    const payload = verify(token, this.jwtSecret) as unknown as AccessTokenPayload;
    if (payload.type !== 'access' || !payload.sub || !payload.sessionId) {
      throw new Error('Invalid access token');
    }
    return {
      sub: Number(payload.sub),
      sessionId: payload.sessionId,
      type: 'access',
    };
  }

  createRefreshToken() {
    return randomBytes(48).toString('hex');
  }

  hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  createSessionId() {
    return randomUUID();
  }

  refreshExpiresAt() {
    const match = /^(\d+)([smhd])$/.exec(this.refreshExpiresIn);
    const amount = match ? Number(match[1]) : 30;
    const unit = match?.[2] ?? 'd';
    const ms =
      unit === 's'
        ? amount * 1000
        : unit === 'm'
          ? amount * 60 * 1000
          : unit === 'h'
            ? amount * 60 * 60 * 1000
            : amount * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + ms);
  }
}
