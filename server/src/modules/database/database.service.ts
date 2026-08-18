import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    const connectionString = this.configService.get<string>('database.url');

    this.pool = new Pool({
      ...(connectionString
        ? {
            connectionString,
            ssl: { rejectUnauthorized: false },
          }
        : {
            host: this.configService.get<string>('database.host'),
            port: this.configService.get<number>('database.port'),
            database: this.configService.get<string>('database.name'),
            user: this.configService.get<string>('database.user'),
            password: this.configService.get<string>('database.password'),
            ssl:
              process.env.NODE_ENV === 'production'
                ? { rejectUnauthorized: false }
                : undefined,
          }),
      max: this.configService.get<number>('database.pool.max'),
      idleTimeoutMillis: this.configService.get<number>(
        'database.pool.idleTimeout',
      ),
      connectionTimeoutMillis: this.configService.get<number>(
        'database.pool.connectionTimeout',
      ),
    });
  }

  async query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
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
