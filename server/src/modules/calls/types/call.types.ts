export enum CallStatus {
  INITIATED = 'initiated',
  RINGING = 'ringing',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  BUSY = 'busy',
  MISSED = 'missed',
  ENDED = 'ended',
  FAILED = 'failed',
}

export enum CallType {
  AUDIO = 'audio',
  VIDEO = 'video',
}

export enum CallErrorCode {
  CALL_NOT_FOUND = 'CALL_NOT_FOUND',
  CALL_ALREADY_ENDED = 'CALL_ALREADY_ENDED',
  USER_OFFLINE = 'USER_OFFLINE',
  USER_BUSY = 'USER_BUSY',
  INVALID_CALL_PARTICIPANT = 'INVALID_CALL_PARTICIPANT',
  UNAUTHORIZED_CALL_ACCESS = 'UNAUTHORIZED_CALL_ACCESS',
  INVALID_CALL_STATE = 'INVALID_CALL_STATE',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  CANNOT_CALL_SELF = 'CANNOT_CALL_SELF',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
}

export const ACTIVE_CALL_STATUSES: readonly CallStatus[] = [
  CallStatus.INITIATED,
  CallStatus.RINGING,
  CallStatus.ACCEPTED,
];

export const TERMINAL_CALL_STATUSES: readonly CallStatus[] = [
  CallStatus.REJECTED,
  CallStatus.BUSY,
  CallStatus.MISSED,
  CallStatus.ENDED,
  CallStatus.FAILED,
];

export type CallSessionRow = {
  call_id: string;
  caller_id: number;
  receiver_id: number;
  call_type: CallType;
  status: CallStatus;
  started_at: Date | null;
  answered_at: Date | null;
  ended_at: Date | null;
  duration_seconds: number | null;
  created_at: Date;
};

export type CallSessionDto = {
  callId: string;
  callerId: number;
  receiverId: number;
  callType: CallType;
  status: CallStatus;
  startedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  createdAt: string;
};

export type IceServerConfig = {
  urls: string;
  username?: string;
  credential?: string;
};

export type SdpType = 'offer' | 'answer' | 'pranswer' | 'rollback';

export type SessionDescriptionPayload = {
  type: SdpType;
  sdp?: string;
};

export type IceCandidatePayload = {
  candidate?: string | null;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

export function toCallSessionDto(row: CallSessionRow): CallSessionDto {
  return {
    callId: String(row.call_id),
    callerId: Number(row.caller_id),
    receiverId: Number(row.receiver_id),
    callType: row.call_type,
    status: row.status,
    startedAt: row.started_at ? row.started_at.toISOString() : null,
    answeredAt: row.answered_at ? row.answered_at.toISOString() : null,
    endedAt: row.ended_at ? row.ended_at.toISOString() : null,
    durationSeconds: row.duration_seconds,
    createdAt: row.created_at.toISOString(),
  };
}
