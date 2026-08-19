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
  timeoutMs = 20000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, result: CallAck<T>) => {
      if (err) {
        if (err.message?.toLowerCase().includes('timed out')) {
          reject(
            new Error(
              `Could not reach the server (${event}). Check your connection and try again.`,
            ),
          );
          return;
        }
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

function emitNoAck(socket: Socket, event: string, payload: object): Promise<{ ok: true }> {
  socket.emit(event, payload);
  return Promise.resolve({ ok: true });
}

export const callSocket = {
  initiate(
    socket: Socket,
    payload: { receiverId: number; callType: CallType },
  ) {
    return emitAck<CallSession>(socket, 'call:initiate', payload, 30000);
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
    return emitNoAck(socket, 'call:offer', payload);
  },

  answer(
    socket: Socket,
    payload: { callId: string; receiverId: number; sdp: RTCSessionDescriptionInit },
  ) {
    return emitNoAck(socket, 'call:answer', payload);
  },

  iceCandidate(
    socket: Socket,
    payload: {
      callId: string;
      receiverId: number;
      candidate: RTCIceCandidateInit;
    },
  ) {
    return emitNoAck(socket, 'call:ice-candidate', payload);
  },
};
