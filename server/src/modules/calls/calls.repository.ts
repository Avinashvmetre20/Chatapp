import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CallSessionRow,
  CallStatus,
  CallType,
} from './types/call.types';

const CALL_COLUMNS = `
  call_id::text AS call_id,
  caller_id,
  receiver_id,
  call_type,
  status,
  started_at,
  answered_at,
  ended_at,
  duration_seconds,
  created_at
`;

@Injectable()
export class CallsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async userExists(userId: number) {
    const result = await this.databaseService.query<{ user_id: number }>(
      `SELECT user_id FROM user_master WHERE user_id = $1`,
      [userId],
    );
    return Boolean(result.rows[0]);
  }

  async create(params: {
    callerId: number;
    receiverId: number;
    callType: CallType;
    status: CallStatus;
    startedAt?: Date | null;
    endedAt?: Date | null;
  }): Promise<CallSessionRow> {
    const result = await this.databaseService.query<CallSessionRow>(
      `INSERT INTO call_sessions (
         caller_id, receiver_id, call_type, status, started_at, ended_at
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${CALL_COLUMNS}`,
      [
        params.callerId,
        params.receiverId,
        params.callType,
        params.status,
        params.startedAt ?? null,
        params.endedAt ?? null,
      ],
    );

    return result.rows[0];
  }

  async findById(callId: string): Promise<CallSessionRow | null> {
    const result = await this.databaseService.query<CallSessionRow>(
      `SELECT ${CALL_COLUMNS}
       FROM call_sessions
       WHERE call_id = $1`,
      [callId],
    );

    return result.rows[0] ?? null;
  }

  async listForUser(userId: number, limit: number): Promise<CallSessionRow[]> {
    const result = await this.databaseService.query<CallSessionRow>(
      `SELECT ${CALL_COLUMNS}
       FROM call_sessions
       WHERE caller_id = $1 OR receiver_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit],
    );

    return result.rows;
  }

  async update(
    callId: string,
    fields: {
      status?: CallStatus;
      answeredAt?: Date | null;
      endedAt?: Date | null;
      durationSeconds?: number | null;
    },
  ): Promise<CallSessionRow | null> {
    const sets: string[] = [];
    const values: unknown[] = [];

    const add = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (fields.status !== undefined) {
      add('status', fields.status);
    }
    if (fields.answeredAt !== undefined) {
      add('answered_at', fields.answeredAt);
    }
    if (fields.endedAt !== undefined) {
      add('ended_at', fields.endedAt);
    }
    if (fields.durationSeconds !== undefined) {
      add('duration_seconds', fields.durationSeconds);
    }

    if (sets.length === 0) {
      return this.findById(callId);
    }

    values.push(callId);
    const result = await this.databaseService.query<CallSessionRow>(
      `UPDATE call_sessions
       SET ${sets.join(', ')}
       WHERE call_id = $${values.length}
       RETURNING ${CALL_COLUMNS}`,
      values,
    );

    return result.rows[0] ?? null;
  }
}
