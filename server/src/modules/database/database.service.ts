import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly configService: ConfigService) {
    this.pool = new Pool({
      host: this.configService.get<string>('database.host'),
      port: this.configService.get<number>('database.port'),
      database: this.configService.get<string>('database.name'),
      user: this.configService.get<string>('database.user'),
      password: this.configService.get<string>('database.password'),
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

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
