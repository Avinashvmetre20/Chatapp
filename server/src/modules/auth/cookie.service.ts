import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';

/** Single HttpOnly refresh cookie — setting again replaces the previous value. */
export const REFRESH_COOKIE = 'chatapp_token';

/** Legacy name from earlier builds; cleared on set/clear so only one cookie remains. */
const LEGACY_REFRESH_COOKIE = 'refresh_token';

@Injectable()
export class CookieService {
  constructor(private readonly configService: ConfigService) {}

  setRefreshToken(response: Response, token: string, expiresAt: Date) {
    this.clearLegacyRefreshCookie(response);
    response.cookie(REFRESH_COOKIE, token, this.options(expiresAt));
  }

  clearRefreshToken(response: Response) {
    const cleared = {
      ...this.options(new Date(0)),
      maxAge: 0,
    };
    response.cookie(REFRESH_COOKIE, '', cleared);
    response.cookie(LEGACY_REFRESH_COOKIE, '', cleared);
  }

  private clearLegacyRefreshCookie(response: Response) {
    response.cookie(LEGACY_REFRESH_COOKIE, '', {
      ...this.options(new Date(0)),
      maxAge: 0,
    });
  }

  private options(expiresAt: Date): CookieOptions {
    const sameSite =
      this.configService.get<'lax' | 'strict' | 'none'>('auth.cookie.sameSite') ??
      'lax';
    const secure = Boolean(this.configService.get<boolean>('auth.cookie.secure'));

    return {
      httpOnly:
        this.configService.get<boolean>('auth.cookie.httpOnly') !== false,
      secure: sameSite === 'none' ? true : secure,
      sameSite,
      expires: expiresAt,
      path: '/',
    };
  }
}
