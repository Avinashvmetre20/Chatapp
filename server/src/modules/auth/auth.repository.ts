import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { SqlQuery } from '../database/database.types';

export type SafeUserRow = {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  last_seen: Date | null;
};

export type UserWithCredential = SafeUserRow & {
  password_hash: string;
};

export type SessionRow = {
  session_id: string;
  user_id: number;
  refresh_token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
};

const USER_COLUMNS = `
  user_id, first_name, last_name, email, status, created_at, updated_at, last_seen
`;

@Injectable()
export class AuthRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  findByEmail(email: string) {
    return this.databaseService.query<SafeUserRow>(
      `SELECT ${USER_COLUMNS}
       FROM user_master
       WHERE LOWER(email) = LOWER($1)`,
      [email],
    );
  }

  findById(userId: number) {
    return this.databaseService.query<SafeUserRow>(
      `SELECT ${USER_COLUMNS}
       FROM user_master
       WHERE user_id = $1`,
      [userId],
    );
  }

  findAuthByEmail(email: string) {
    return this.databaseService.query<UserWithCredential>(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.status,
              u.created_at, u.updated_at, u.last_seen, c.password_hash
       FROM user_master u
       JOIN user_credentials c ON c.user_id = u.user_id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email],
    );
  }

  findAuthByUserId(userId: number) {
    return this.databaseService.query<UserWithCredential>(
      `SELECT u.user_id, u.first_name, u.last_name, u.email, u.status,
              u.created_at, u.updated_at, u.last_seen, c.password_hash
       FROM user_master u
       JOIN user_credentials c ON c.user_id = u.user_id
       WHERE u.user_id = $1`,
      [userId],
    );
  }

  createUser(
    query: SqlQuery,
    params: {
      firstName: string;
      lastName: string;
      email: string;
    },
  ) {
    return query<SafeUserRow>(
      `INSERT INTO user_master (first_name, last_name, email, status, last_seen)
       VALUES ($1, $2, LOWER($3), 'active', NOW())
       RETURNING ${USER_COLUMNS}`,
      [params.firstName, params.lastName, params.email],
    );
  }

  createCredential(
    query: SqlQuery,
    userId: number,
    passwordHash: string,
  ) {
    return query(
      `INSERT INTO user_credentials (user_id, password_hash)
       VALUES ($1, $2)`,
      [userId, passwordHash],
    );
  }

  updatePassword(userId: number, passwordHash: string) {
    return this.databaseService.query(
      `UPDATE user_credentials
       SET password_hash = $2,
           password_changed_at = NOW(),
           updated_at = NOW()
       WHERE user_id = $1`,
      [userId, passwordHash],
    );
  }

  touchLastSeen(userId: number) {
    return this.databaseService.query(
      `UPDATE user_master SET last_seen = NOW(), updated_at = NOW()
       WHERE user_id = $1`,
      [userId],
    );
  }

  createSession(params: {
    sessionId: string;
    userId: number;
    refreshTokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.databaseService.query(
      `INSERT INTO user_sessions (
         session_id, user_id, refresh_token_hash, expires_at, ip_address, user_agent
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.sessionId,
        params.userId,
        params.refreshTokenHash,
        params.expiresAt,
        params.ipAddress ?? null,
        params.userAgent ?? null,
      ],
    );
  }

  findSession(sessionId: string) {
    return this.databaseService.query<SessionRow>(
      `SELECT session_id, user_id, refresh_token_hash, expires_at, revoked_at
       FROM user_sessions
       WHERE session_id = $1`,
      [sessionId],
    );
  }

  findSessionByRefreshHash(tokenHash: string) {
    return this.databaseService.query<SessionRow>(
      `SELECT session_id, user_id, refresh_token_hash, expires_at, revoked_at
       FROM user_sessions
       WHERE refresh_token_hash = $1`,
      [tokenHash],
    );
  }

  rotateSession(
    sessionId: string,
    refreshTokenHash: string,
    expiresAt: Date,
  ) {
    return this.databaseService.query(
      `UPDATE user_sessions
       SET refresh_token_hash = $2,
           last_used_at = NOW(),
           expires_at = $3
       WHERE session_id = $1
         AND revoked_at IS NULL`,
      [sessionId, refreshTokenHash, expiresAt],
    );
  }

  revokeSession(sessionId: string) {
    return this.databaseService.query(
      `UPDATE user_sessions
       SET revoked_at = NOW()
       WHERE session_id = $1
         AND revoked_at IS NULL`,
      [sessionId],
    );
  }

  revokeAllSessions(userId: number, exceptSessionId?: string) {
    if (exceptSessionId) {
      return this.databaseService.query(
        `UPDATE user_sessions
         SET revoked_at = NOW()
         WHERE user_id = $1
           AND session_id <> $2
           AND revoked_at IS NULL`,
        [userId, exceptSessionId],
      );
    }
    return this.databaseService.query(
      `UPDATE user_sessions
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND revoked_at IS NULL`,
      [userId],
    );
  }

  countRecentFailures(email: string, since: Date) {
    return this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM login_attempts
       WHERE LOWER(email) = LOWER($1)
         AND status = 'FAILED'
         AND created_at >= $2`,
      [email, since],
    );
  }

  recordLoginAttempt(params: {
    userId?: number | null;
    email: string;
    ipAddress?: string;
    userAgent?: string;
    status: 'SUCCESS' | 'FAILED' | 'LOCKED';
    failureReason?: string;
  }) {
    return this.databaseService.query(
      `INSERT INTO login_attempts (
         user_id, email, ip_address, user_agent, status, failure_reason
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.userId ?? null,
        params.email,
        params.ipAddress ?? null,
        params.userAgent ?? null,
        params.status,
        params.failureReason ?? null,
      ],
    );
  }

  writeAudit(params: {
    userId?: number | null;
    event: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, string | number | boolean | null>;
  }) {
    return this.databaseService.query(
      `INSERT INTO user_audit_logs (user_id, event, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        params.userId ?? null,
        params.event,
        params.ipAddress ?? null,
        params.userAgent ?? null,
        params.metadata ? JSON.stringify(params.metadata) : null,
      ],
    );
  }

  createResetToken(userId: number, tokenHash: string, expiresAt: Date) {
    return this.databaseService.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  }

  findResetToken(tokenHash: string) {
    return this.databaseService.query<{
      id: string;
      user_id: number;
      expires_at: Date;
      used_at: Date | null;
    }>(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  markResetTokenUsed(id: string) {
    return this.databaseService.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
      [id],
    );
  }
}
