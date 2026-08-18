import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash as bcryptHash } from 'bcryptjs';
import { Pool, QueryResult, QueryResultRow } from 'pg';
import { SqlQuery } from './database.types';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>('database.url');

    if (!connectionString) {
      throw new InternalServerErrorException(
        'DATABASE_URL is not configured',
      );
    }

    this.pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: this.configService.get<number>('database.pool.max'),
      idleTimeoutMillis: this.configService.get<number>(
        'database.pool.idleTimeout',
      ),
      connectionTimeoutMillis: this.configService.get<number>(
        'database.pool.connectionTimeout',
      ),
    });
  }

  async onModuleInit() {
    await this.pool.query(`
      ALTER TABLE chat_master
      ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'sent'
    `);
    await this.pool.query(`
      ALTER TABLE user_master
      ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ
    `);
    await this.pool.query(`
      ALTER TABLE user_master
      ADD COLUMN IF NOT EXISTS email VARCHAR(255)
    `);
    await this.pool.query(`
      ALTER TABLE user_master
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS call_sessions (
        call_id BIGSERIAL PRIMARY KEY,
        caller_id BIGINT NOT NULL,
        receiver_id BIGINT NOT NULL,
        call_type VARCHAR(20) NOT NULL,
        status VARCHAR(30) NOT NULL,
        started_at TIMESTAMPTZ,
        answered_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ,
        duration_seconds INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_call_sessions_caller_id
      ON call_sessions(caller_id)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_call_sessions_receiver_id
      ON call_sessions(receiver_id)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_call_sessions_created_at
      ON call_sessions(created_at DESC)
    `);

    await this.ensureAuthTables();
    await this.migrateLegacyPasswords();
  }

  async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async withTransaction<T>(fn: (query: SqlQuery) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const query: SqlQuery = <R extends QueryResultRow>(
        text: string,
        params?: unknown[],
      ) => client.query<R>(text, params);
      const result = await fn(query);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<string | null> {
    try {
      const result = await this.pool.query<{ current_database: string }>(
        'SELECT current_database()',
      );
      return result.rows[0]?.current_database ?? null;
    } catch {
      return null;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  private async ensureAuthTables() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS user_credentials (
        credential_id BIGSERIAL PRIMARY KEY,
        user_id BIGINT UNIQUE NOT NULL REFERENCES user_master(user_id),
        password_hash TEXT NOT NULL,
        password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        session_id UUID PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES user_master(user_id),
        refresh_token_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_used_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        ip_address INET,
        user_agent TEXT
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
      ON user_sessions(user_id)
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS login_attempts (
        attempt_id BIGSERIAL PRIMARY KEY,
        user_id BIGINT,
        email VARCHAR(255),
        ip_address INET,
        user_agent TEXT,
        status VARCHAR(20) NOT NULL,
        failure_reason VARCHAR(100),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created
      ON login_attempts(email, created_at DESC)
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES user_master(user_id),
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS user_audit_logs (
        audit_id BIGSERIAL PRIMARY KEY,
        user_id BIGINT,
        event VARCHAR(50) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  private async migrateLegacyPasswords() {
    const column = await this.pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'user_master'
         AND column_name = 'password'`,
    );

    if (column.rows[0]) {
      const users = await this.pool.query<{
        user_id: number;
        first_name: string;
        last_name: string;
        email: string | null;
        password: string | null;
      }>(
        `SELECT user_id, first_name, last_name, email, password
         FROM user_master`,
      );

      const saltRounds =
        this.configService.get<number>('auth.bcryptSaltRounds') ?? 12;

      for (const user of users.rows) {
        if (user.password) {
          const passwordHash = await bcryptHash(user.password, saltRounds);
          await this.pool.query(
            `INSERT INTO user_credentials (user_id, password_hash)
             VALUES ($1, $2)
             ON CONFLICT (user_id) DO NOTHING`,
            [user.user_id, passwordHash],
          );
        }

        if (!user.email) {
          await this.pool.query(
            `UPDATE user_master
             SET email = $1
             WHERE user_id = $2
               AND email IS NULL`,
            [`user${user.user_id}@migrated.local`, user.user_id],
          );
        }
      }

      await this.pool.query(`ALTER TABLE user_master DROP COLUMN password`);
    }

    await this.pool.query(
      `UPDATE user_master
       SET email = 'user' || user_id || '@migrated.local'
       WHERE email IS NULL`,
    );
    await this.pool.query(
      `ALTER TABLE user_master ALTER COLUMN email SET NOT NULL`,
    );
    await this.pool.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS user_master_email_key
       ON user_master (LOWER(email))`,
    );
  }
}
