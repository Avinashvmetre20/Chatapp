import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { DatabaseService } from '../database/database.service';
import { AuthRepository } from './auth.repository';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { AuthErrorCode, AuthException } from './types/auth.exception';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

export type SafeUser = {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_seen: string | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly authRepository: AuthRepository,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.authRepository.findByEmail(email);
    if (existing.rows[0]) {
      throw new AuthException(
        AuthErrorCode.EMAIL_IN_USE,
        'An account with this email already exists',
        409,
      );
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    const user = await this.databaseService.withTransaction(async (query) => {
      const created = await this.authRepository.createUser(query, {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
      });
      const row = created.rows[0];
      await this.authRepository.createCredential(query, row.user_id, passwordHash);
      return row;
    });

    await this.authRepository.writeAudit({
      userId: user.user_id,
      event: 'REGISTER',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.createSession(user.user_id, meta);
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const email = dto.email.trim().toLowerCase();
    const lockMinutes =
      this.configService.get<number>('auth.loginLockMinutes') ?? 15;
    const maxAttempts =
      this.configService.get<number>('auth.loginMaxAttempts') ?? 5;
    const since = new Date(Date.now() - lockMinutes * 60 * 1000);
    const failures = await this.authRepository.countRecentFailures(email, since);
    const failCount = Number(failures.rows[0]?.count ?? 0);

    if (failCount >= maxAttempts) {
      await this.authRepository.recordLoginAttempt({
        email,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        status: 'LOCKED',
        failureReason: 'ACCOUNT_LOCKED',
      });
      await this.authRepository.writeAudit({
        event: 'ACCOUNT_LOCKED',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { email },
      });
      throw new AuthException(
        AuthErrorCode.ACCOUNT_LOCKED,
        'Invalid email or password.',
        401,
      );
    }

    const found = await this.authRepository.findAuthByEmail(email);
    const account = found.rows[0];

    if (!account) {
      await this.failLogin(null, email, meta, 'USER_NOT_FOUND');
      throw new AuthException(
        AuthErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password.',
      );
    }

    if (account.status !== 'active') {
      await this.failLogin(account.user_id, email, meta, 'ACCOUNT_INACTIVE');
      throw new AuthException(
        AuthErrorCode.ACCOUNT_INACTIVE,
        'Invalid email or password.',
      );
    }

    const matches = await this.passwordService.compare(
      dto.password,
      account.password_hash,
    );
    if (!matches) {
      await this.failLogin(account.user_id, email, meta, 'BAD_PASSWORD');
      throw new AuthException(
        AuthErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password.',
      );
    }

    await this.authRepository.recordLoginAttempt({
      userId: account.user_id,
      email,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      status: 'SUCCESS',
    });
    await this.authRepository.writeAudit({
      userId: account.user_id,
      event: 'LOGIN_SUCCESS',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await this.authRepository.touchLastSeen(account.user_id);

    return this.createSession(account.user_id, meta);
  }

  async refresh(rawRefreshToken: string | undefined, meta: RequestMeta) {
    if (!rawRefreshToken) {
      throw new AuthException(
        AuthErrorCode.SESSION_EXPIRED,
        'Session expired. Please sign in again.',
      );
    }

    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    const found = await this.authRepository.findSessionByRefreshHash(tokenHash);
    const session = found.rows[0];

    if (
      !session ||
      session.revoked_at ||
      new Date(session.expires_at).getTime() <= Date.now()
    ) {
      throw new AuthException(
        AuthErrorCode.SESSION_EXPIRED,
        'Session expired. Please sign in again.',
      );
    }

    return this.rotateSession(
      session.session_id,
      Number(session.user_id),
      session.refresh_token_hash,
      meta,
    );
  }

  async logout(sessionId: string, userId: number, meta: RequestMeta) {
    await this.authRepository.revokeSession(sessionId);
    await this.authRepository.writeAudit({
      userId,
      event: 'LOGOUT',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async logoutAll(userId: number, meta: RequestMeta) {
    await this.authRepository.revokeAllSessions(userId);
    await this.authRepository.writeAudit({
      userId,
      event: 'LOGOUT_ALL',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async me(userId: number) {
    const found = await this.authRepository.findById(userId);
    if (!found.rows[0]) {
      throw new AuthException(
        AuthErrorCode.USER_NOT_FOUND,
        'User not found',
        404,
      );
    }
    return { user: this.toSafeUser(found.rows[0]) };
  }

  async changePassword(
    userId: number,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
    meta: RequestMeta,
  ) {
    const found = await this.authRepository.findAuthByUserId(userId);
    const account = found.rows[0];
    if (!account) {
      throw new AuthException(
        AuthErrorCode.USER_NOT_FOUND,
        'User not found',
        404,
      );
    }

    const matches = await this.passwordService.compare(
      currentPassword,
      account.password_hash,
    );
    if (!matches) {
      throw new AuthException(
        AuthErrorCode.INVALID_PASSWORD,
        'Current password is incorrect',
        400,
      );
    }

    const passwordHash = await this.passwordService.hash(newPassword);
    await this.authRepository.updatePassword(userId, passwordHash);
    await this.authRepository.revokeAllSessions(userId, sessionId);
    await this.authRepository.writeAudit({
      userId,
      event: 'PASSWORD_CHANGED',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { ok: true };
  }

  async forgotPassword(email: string, meta: RequestMeta) {
    const normalized = email.trim().toLowerCase();
    const found = await this.authRepository.findByEmail(normalized);
    const user = found.rows[0];

    if (user) {
      const rawToken = this.tokenService.createRefreshToken();
      const tokenHash = this.tokenService.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await this.authRepository.createResetToken(
        user.user_id,
        tokenHash,
        expiresAt,
      );
      await this.authRepository.writeAudit({
        userId: user.user_id,
        event: 'PASSWORD_RESET',
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { stage: 'requested' },
      });
      this.logger.log(
        JSON.stringify({ event: 'PASSWORD_RESET_REQUESTED', userId: user.user_id }),
      );
    }

    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string, meta: RequestMeta) {
    const tokenHash = this.tokenService.hashToken(token);
    const found = await this.authRepository.findResetToken(tokenHash);
    const row = found.rows[0];

    if (
      !row ||
      row.used_at ||
      new Date(row.expires_at).getTime() <= Date.now()
    ) {
      throw new AuthException(
        AuthErrorCode.RESET_TOKEN_INVALID,
        'This reset link is invalid or has expired',
        400,
      );
    }

    const passwordHash = await this.passwordService.hash(newPassword);
    await this.authRepository.updatePassword(Number(row.user_id), passwordHash);
    await this.authRepository.markResetTokenUsed(row.id);
    await this.authRepository.revokeAllSessions(Number(row.user_id));
    await this.authRepository.writeAudit({
      userId: Number(row.user_id),
      event: 'PASSWORD_RESET',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { stage: 'completed' },
    });

    return { ok: true };
  }

  async assertAccessToken(token: string) {
    let payload;
    try {
      payload = this.tokenService.verifyAccessToken(token);
    } catch {
      throw new AuthException(
        AuthErrorCode.INVALID_TOKEN,
        'Authentication required',
      );
    }

    const session = await this.authRepository.findSession(payload.sessionId);
    const row = session.rows[0];
    if (
      !row ||
      row.revoked_at ||
      Number(row.user_id) !== payload.sub ||
      new Date(row.expires_at).getTime() <= Date.now()
    ) {
      throw new AuthException(
        AuthErrorCode.SESSION_EXPIRED,
        'Session expired. Please sign in again.',
      );
    }

    const user = await this.authRepository.findById(payload.sub);
    if (!user.rows[0] || user.rows[0].status !== 'active') {
      throw new AuthException(
        AuthErrorCode.UNAUTHORIZED,
        'Authentication required',
      );
    }

    return {
      userId: payload.sub,
      sessionId: payload.sessionId,
    };
  }

  requestMeta(request: Request): RequestMeta {
    const forwarded = request.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() ||
      request.ip;
    return {
      ipAddress: ip,
      userAgent: request.headers['user-agent'],
    };
  }

  toSafeUser(row: {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
    status: string;
    created_at: Date;
    updated_at: Date;
    last_seen: Date | null;
  }): SafeUser {
    return {
      user_id: Number(row.user_id),
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      status: row.status,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
      last_seen: row.last_seen ? row.last_seen.toISOString() : null,
    };
  }

  private async createSession(userId: number, meta: RequestMeta) {
    const sessionId = this.tokenService.createSessionId();
    const refreshToken = this.tokenService.createRefreshToken();
    const refreshTokenHash = this.tokenService.hashToken(refreshToken);
    const expiresAt = this.tokenService.refreshExpiresAt();

    await this.authRepository.createSession({
      sessionId,
      userId,
      refreshTokenHash,
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const userRow = await this.authRepository.findById(userId);
    return {
      user: this.toSafeUser(userRow.rows[0]),
      accessToken: this.tokenService.createAccessToken(userId, sessionId),
      refreshToken,
      refreshExpiresAt: expiresAt,
      sessionId,
    };
  }

  private async rotateSession(
    sessionId: string,
    userId: number,
    currentRefreshHash: string,
    _meta: RequestMeta,
  ) {
    const refreshToken = this.tokenService.createRefreshToken();
    const refreshTokenHash = this.tokenService.hashToken(refreshToken);
    const expiresAt = this.tokenService.refreshExpiresAt();
    await this.authRepository.rotateSession(
      sessionId,
      currentRefreshHash,
      refreshTokenHash,
      expiresAt,
    );

    const userRow = await this.authRepository.findById(userId);
    if (!userRow.rows[0]) {
      throw new AuthException(
        AuthErrorCode.USER_NOT_FOUND,
        'User not found',
        404,
      );
    }

    return {
      user: this.toSafeUser(userRow.rows[0]),
      accessToken: this.tokenService.createAccessToken(userId, sessionId),
      refreshToken,
      refreshExpiresAt: expiresAt,
      sessionId,
    };
  }

  private async failLogin(
    userId: number | null,
    email: string,
    meta: RequestMeta,
    reason: string,
  ) {
    await this.authRepository.recordLoginAttempt({
      userId,
      email,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      status: 'FAILED',
      failureReason: reason,
    });
    await this.authRepository.writeAudit({
      userId,
      event: 'LOGIN_FAILED',
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { reason },
    });
  }
}
