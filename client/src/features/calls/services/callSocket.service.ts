import type { Socket } from 'socket.io-client';
import type { CallSession, CallType } from '../types/call.types';

type CallAck<T> = T | { error: string; message?: string };

function isErrorAck<T>(value: CallAck<T>): value is { error: string; message?: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'string'
  );
}

function emitAck<T>(
  socket: Socket,
  event: string,
  payload: object,
): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(12000).emit(event, payload, (err: Error | null, result: CallAck<T>) => {
      if (err) {
        reject(err);
        return;
      }
      if (isErrorAck(result)) {
        reject(new Error(result.message || result.error));
        return;
      }
      resolve(result);
    });
  });
}

export const callSocket = {
  initiate(
    socket: Socket,
    payload: { receiverId: number; callType: CallType },
  ) {
    return emitAck<CallSession>(socket, 'call:initiate', payload);
  },

  accept(socket: Socket, callId: string) {
    return emitAck<CallSession>(socket, 'call:accept', { callId });
  },

  reject(socket: Socket, callId: string) {
    return emitAck<CallSession>(socket, 'call:reject', { callId });
  },

  end(socket: Socket, callId: string) {
    return emitAck<CallSession>(socket, 'call:end', { callId });
  },

  offer(
    socket: Socket,
    payload: { callId: string; receiverId: number; sdp: RTCSessionDescriptionInit },
  ) {
    return emitAck<{ ok: true }>(socket, 'call:offer', payload);
  },

  answer(
    socket: Socket,
    payload: { callId: string; receiverId: number; sdp: RTCSessionDescriptionInit },
  ) {
    return emitAck<{ ok: true }>(socket, 'call:answer', payload);
  },

  iceCandidate(
    socket: Socket,
    payload: {
      callId: string;
      receiverId: number;
      candidate: RTCIceCandidateInit;
    },
  ) {
    return emitAck<{ ok: true }>(socket, 'call:ice-candidate', payload);
  },
};
