import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

export const REFRESH_COOKIE = 'refresh_token';

@Injectable()
export class CookieService {
  constructor(private readonly configService: ConfigService) {}

  setRefreshToken(response: Response, token: string, expiresAt: Date) {
    response.cookie(REFRESH_COOKIE, token, this.options(expiresAt));
  }

  clearRefreshToken(response: Response) {
    response.cookie(REFRESH_COOKIE, '', {
      ...this.options(new Date(0)),
      maxAge: 0,
    });
  }

  private options(expiresAt: Date): CookieOptions {
    const sameSite =
      this.configService.get<'lax' | 'strict' | 'none'>('auth.cookie.sameSite') ??
      'lax';

    return {
      httpOnly:
        this.configService.get<boolean>('auth.cookie.httpOnly') !== false,
      secure: Boolean(this.configService.get<boolean>('auth.cookie.secure')),
      sameSite,
      expires: expiresAt,
      path: '/auth',
    };
  }
}
