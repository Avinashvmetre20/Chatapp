import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

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
  }

  async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async transaction<T>(
    fn: (
      query: <R extends QueryResultRow>(
        text: string,
        params?: unknown[],
      ) => Promise<QueryResult<R>>,
    ) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn((text, params) => client.query(text, params));
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
}
