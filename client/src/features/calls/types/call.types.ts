export const CallStatus = {
  INITIATED: 'initiated',
  RINGING: 'ringing',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  BUSY: 'busy',
  MISSED: 'missed',
  ENDED: 'ended',
  FAILED: 'failed',
} as const;

export type CallStatus = (typeof CallStatus)[keyof typeof CallStatus];

export const CallType = {
  AUDIO: 'audio',
  VIDEO: 'video',
} as const;

export type CallType = (typeof CallType)[keyof typeof CallType];

export const CallErrorCode = {
  CALL_NOT_FOUND: 'CALL_NOT_FOUND',
  CALL_ALREADY_ENDED: 'CALL_ALREADY_ENDED',
  USER_OFFLINE: 'USER_OFFLINE',
  USER_BUSY: 'USER_BUSY',
  INVALID_CALL_PARTICIPANT: 'INVALID_CALL_PARTICIPANT',
  UNAUTHORIZED_CALL_ACCESS: 'UNAUTHORIZED_CALL_ACCESS',
  INVALID_CALL_STATE: 'INVALID_CALL_STATE',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  CANNOT_CALL_SELF: 'CANNOT_CALL_SELF',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
} as const;

export type CallErrorCode = (typeof CallErrorCode)[keyof typeof CallErrorCode];

export type CallSession = {
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

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type CallPhase =
  | 'idle'
  | 'outgoing'
  | 'incoming'
  | 'connecting'
  | 'in-call';

export type MediaPermissionError =
  | 'permission-denied'
  | 'device-unavailable'
  | 'device-in-use'
  | 'not-supported'
  | 'unknown';
