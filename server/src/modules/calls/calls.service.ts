import {
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PresenceService } from '../presence/presence.service';
import { ActiveCallStore } from './active-call.store';
import { CallsGateway } from './calls.gateway';
import { CallsRepository } from './calls.repository';
import { CallException } from './types/call.exception';
import {
  CallErrorCode,
  CallSessionDto,
  CallStatus,
  CallType,
  IceCandidatePayload,
  IceServerConfig,
  SessionDescriptionPayload,
  TERMINAL_CALL_STATUSES,
  toCallSessionDto,
} from './types/call.types';

@Injectable()
export class CallsService implements OnModuleInit {
  private readonly logger = new Logger(CallsService.name);
  private readonly ringTimers = new Map<string, NodeJS.Timeout>();
  private readonly ringTimeoutMs: number;

  constructor(
    private readonly callsRepository: CallsRepository,
    private readonly presenceService: PresenceService,
    private readonly activeCallStore: ActiveCallStore,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => CallsGateway))
    private readonly callsGateway: CallsGateway,
  ) {
    const seconds =
      this.configService.get<number>('calls.ringTimeoutSeconds') ?? 30;
    this.ringTimeoutMs = seconds * 1000;
  }

  onModuleInit() {
    this.presenceService.onUserOffline((userId) => {
      void this.handleUserOffline(userId);
    });
  }

  getIceServers(): IceServerConfig[] {
    const stunUrl = this.configService.get<string>('webrtc.stunUrl');
    const turnUrl = this.configService.get<string>('webrtc.turnUrl');
    const turnUsername = this.configService.get<string>('webrtc.turnUsername');
    const turnPassword = this.configService.get<string>('webrtc.turnPassword');

    const iceServers: IceServerConfig[] = [];
    if (stunUrl) {
      iceServers.push({ urls: stunUrl });
    }
    if (turnUrl && turnUsername && turnPassword) {
      iceServers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnPassword,
      });
    }
    return iceServers;
  }

  async listHistory(userId: number, limit = 50): Promise<CallSessionDto[]> {
    const rows = await this.callsRepository.listForUser(userId, limit);
    return rows.map(toCallSessionDto);
  }

  async getCallForUser(userId: number, callId: string): Promise<CallSessionDto> {
    const call = await this.requireCall(callId);
    this.assertParticipant(userId, call.callerId, call.receiverId);
    return call;
  }

  async resendRingingCalls(userId: number) {
    const callId = this.activeCallStore.getCallId(userId);
    if (!callId) {
      return;
    }

    try {
      const call = await this.requireCall(callId);
      if (call.status !== CallStatus.RINGING) {
        return;
      }
      if (call.callerId !== userId && call.receiverId !== userId) {
        return;
      }
      this.callsGateway.emitToUser(userId, 'call:ringing', { call });
    } catch {
      // Ignore stale in-memory call entries.
    }
  }

  async initiate(
    callerId: number,
    receiverId: number,
    callType: CallType,
  ): Promise<CallSessionDto> {
    if (callerId === receiverId) {
      throw new CallException(
        CallErrorCode.CANNOT_CALL_SELF,
        'You cannot call yourself',
      );
    }

    if (!(await this.callsRepository.userExists(receiverId))) {
      throw new CallException(
        CallErrorCode.USER_NOT_FOUND,
        `User ${receiverId} not found`,
      );
    }

    if (this.activeCallStore.getCallId(callerId)) {
      throw new CallException(
        CallErrorCode.USER_BUSY,
        'You are already in a call',
      );
    }

    if (!this.presenceService.isOnline(receiverId)) {
      const row = await this.callsRepository.create({
        callerId,
        receiverId,
        callType,
        status: CallStatus.FAILED,
        startedAt: new Date(),
        endedAt: new Date(),
      });
      this.logLifecycle('CALL_FAILED', {
        callId: String(row.call_id),
        callerId,
        receiverId,
        reason: CallErrorCode.USER_OFFLINE,
      });
      throw new CallException(
        CallErrorCode.USER_OFFLINE,
        'The other user is offline',
      );
    }

    if (this.activeCallStore.getCallId(receiverId)) {
      const row = await this.callsRepository.create({
        callerId,
        receiverId,
        callType,
        status: CallStatus.BUSY,
        startedAt: new Date(),
        endedAt: new Date(),
      });
      const call = toCallSessionDto(row);
      this.logLifecycle('CALL_BUSY', {
        callId: call.callId,
        callerId,
        receiverId,
      });
      this.callsGateway.emitToUser(callerId, 'call:busy', { call });
      throw new CallException(
        CallErrorCode.USER_BUSY,
        'The other user is in a call',
      );
    }

    const row = await this.callsRepository.create({
      callerId,
      receiverId,
      callType,
      status: CallStatus.RINGING,
      startedAt: new Date(),
    });
    const call = toCallSessionDto(row);

    this.activeCallStore.setUserCall(callerId, call.callId);
    this.activeCallStore.setUserCall(receiverId, call.callId);
    this.startRingTimer(call.callId);

    this.logLifecycle('CALL_INITIATED', {
      callId: call.callId,
      callerId,
      receiverId,
      callType,
    });

    this.callsGateway.emitToUser(receiverId, 'call:ringing', { call });
    this.callsGateway.emitToUser(callerId, 'call:ringing', { call });
    return call;
  }

  async accept(userId: number, callId: string): Promise<CallSessionDto> {
    const current = await this.requireCall(callId);
    this.assertParticipant(userId, current.callerId, current.receiverId);

    if (userId !== current.receiverId) {
      throw new CallException(
        CallErrorCode.INVALID_CALL_PARTICIPANT,
        'Only the receiver can accept this call',
      );
    }

    if (current.status !== CallStatus.RINGING) {
      throw new CallException(
        CallErrorCode.INVALID_CALL_STATE,
        `Call cannot be accepted from status ${current.status}`,
      );
    }

    this.clearRingTimer(callId);
    const row = await this.callsRepository.update(callId, {
      status: CallStatus.ACCEPTED,
      answeredAt: new Date(),
    });
    const call = toCallSessionDto(row!);

    this.logLifecycle('CALL_ACCEPTED', {
      callId,
      callerId: call.callerId,
      receiverId: call.receiverId,
    });

    this.callsGateway.emitToUser(call.callerId, 'call:accept', { call });
    this.callsGateway.emitToUser(call.receiverId, 'call:accept', { call });
    return call;
  }

  async reject(userId: number, callId: string): Promise<CallSessionDto> {
    const current = await this.requireCall(callId);
    this.assertParticipant(userId, current.callerId, current.receiverId);

    if (userId !== current.receiverId) {
      throw new CallException(
        CallErrorCode.INVALID_CALL_PARTICIPANT,
        'Only the receiver can reject this call',
      );
    }

    if (current.status !== CallStatus.RINGING) {
      throw new CallException(
        CallErrorCode.INVALID_CALL_STATE,
        `Call cannot be rejected from status ${current.status}`,
      );
    }

    const call = await this.finishCall(callId, CallStatus.REJECTED);
    this.logLifecycle('CALL_REJECTED', {
      callId,
      callerId: call.callerId,
      receiverId: call.receiverId,
    });
    this.callsGateway.emitToUser(call.callerId, 'call:reject', { call });
    this.callsGateway.emitToUser(call.receiverId, 'call:reject', { call });
    return call;
  }

  async end(userId: number, callId: string): Promise<CallSessionDto> {
    const current = await this.requireCall(callId);
    this.assertParticipant(userId, current.callerId, current.receiverId);

    if (this.isTerminal(current.status)) {
      throw new CallException(
        CallErrorCode.CALL_ALREADY_ENDED,
        'This call has already ended',
      );
    }

    const status =
      current.status === CallStatus.ACCEPTED
        ? CallStatus.ENDED
        : CallStatus.MISSED;
    const call = await this.finishCall(callId, status);
    this.logLifecycle(
      status === CallStatus.ENDED ? 'CALL_ENDED' : 'CALL_MISSED',
      {
        callId,
        callerId: call.callerId,
        receiverId: call.receiverId,
      },
    );

    const otherId =
      userId === call.callerId ? call.receiverId : call.callerId;
    this.callsGateway.emitToUser(otherId, 'call:end', { call });
    this.callsGateway.emitToUser(userId, 'call:end', { call });
    return call;
  }

  async forwardOffer(
    userId: number,
    callId: string,
    sdp: SessionDescriptionPayload,
  ) {
    const call = await this.requireActiveParticipant(userId, callId);
    if (call.status !== CallStatus.ACCEPTED) {
      throw new CallException(
        CallErrorCode.INVALID_CALL_STATE,
        'Offer can only be sent after the call is accepted',
      );
    }
    if (userId !== call.callerId) {
      throw new CallException(
        CallErrorCode.INVALID_CALL_PARTICIPANT,
        'Only the caller can send the offer',
      );
    }

    this.callsGateway.emitToUser(call.receiverId, 'call:offer', {
      callId,
      sdp,
    });
  }

  async forwardAnswer(
    userId: number,
    callId: string,
    sdp: SessionDescriptionPayload,
  ) {
    const call = await this.requireActiveParticipant(userId, callId);
    if (call.status !== CallStatus.ACCEPTED) {
      throw new CallException(
        CallErrorCode.INVALID_CALL_STATE,
        'Answer can only be sent after the call is accepted',
      );
    }
    if (userId !== call.receiverId) {
      throw new CallException(
        CallErrorCode.INVALID_CALL_PARTICIPANT,
        'Only the receiver can send the answer',
      );
    }

    this.callsGateway.emitToUser(call.callerId, 'call:answer', {
      callId,
      sdp,
    });
  }

  async forwardIceCandidate(
    userId: number,
    callId: string,
    candidate: IceCandidatePayload,
  ) {
    const call = await this.requireActiveParticipant(userId, callId);
    if (call.status !== CallStatus.ACCEPTED) {
      throw new CallException(
        CallErrorCode.INVALID_CALL_STATE,
        'ICE candidates can only be sent during an accepted call',
      );
    }

    const otherId =
      userId === call.callerId ? call.receiverId : call.callerId;
    this.callsGateway.emitToUser(otherId, 'call:ice-candidate', {
      callId,
      candidate,
    });
  }

  async handleUserOffline(userId: number) {
    const callId = this.activeCallStore.getCallId(userId);
    if (!callId) {
      return;
    }

    try {
      const current = await this.requireCall(callId);
      if (this.isTerminal(current.status)) {
        this.activeCallStore.clearCall(callId);
        return;
      }

      const status =
        current.status === CallStatus.ACCEPTED
          ? CallStatus.ENDED
          : CallStatus.MISSED;
      const call = await this.finishCall(callId, status);
      this.logLifecycle(
        status === CallStatus.ENDED ? 'CALL_ENDED' : 'CALL_MISSED',
        {
          callId,
          callerId: call.callerId,
          receiverId: call.receiverId,
          reason: 'USER_OFFLINE',
        },
      );

      const otherId =
        userId === call.callerId ? call.receiverId : call.callerId;
      this.callsGateway.emitToUser(otherId, 'call:end', { call });
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'CALL_OFFLINE_CLEANUP_FAILED',
          userId,
          callId,
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }

  private async timeoutCall(callId: string) {
    try {
      const current = await this.requireCall(callId);
      if (current.status !== CallStatus.RINGING) {
        return;
      }

      const call = await this.finishCall(callId, CallStatus.MISSED);
      this.logLifecycle('CALL_MISSED', {
        callId,
        callerId: call.callerId,
        receiverId: call.receiverId,
        reason: 'TIMEOUT',
      });
      this.callsGateway.emitToUser(call.callerId, 'call:timeout', { call });
      this.callsGateway.emitToUser(call.receiverId, 'call:timeout', { call });
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'CALL_TIMEOUT_FAILED',
          callId,
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }

  private async finishCall(callId: string, status: CallStatus) {
    this.clearRingTimer(callId);
    const current = await this.requireCall(callId);
    const endedAt = new Date();
    let durationSeconds: number | null = null;
    if (current.answeredAt) {
      durationSeconds = Math.max(
        0,
        Math.floor((endedAt.getTime() - Date.parse(current.answeredAt)) / 1000),
      );
    }

    const row = await this.callsRepository.update(callId, {
      status,
      endedAt,
      durationSeconds,
    });
    this.activeCallStore.clearCall(callId);
    return toCallSessionDto(row!);
  }

  private startRingTimer(callId: string) {
    this.clearRingTimer(callId);
    const timer = setTimeout(() => {
      this.ringTimers.delete(callId);
      void this.timeoutCall(callId);
    }, this.ringTimeoutMs);
    this.ringTimers.set(callId, timer);
  }

  private clearRingTimer(callId: string) {
    const timer = this.ringTimers.get(callId);
    if (timer) {
      clearTimeout(timer);
      this.ringTimers.delete(callId);
    }
  }

  private async requireCall(callId: string): Promise<CallSessionDto> {
    const row = await this.callsRepository.findById(callId);
    if (!row) {
      throw new CallException(
        CallErrorCode.CALL_NOT_FOUND,
        'Call not found',
      );
    }
    return toCallSessionDto(row);
  }

  private async requireActiveParticipant(userId: number, callId: string) {
    const call = await this.requireCall(callId);
    this.assertParticipant(userId, call.callerId, call.receiverId);
    if (this.isTerminal(call.status)) {
      throw new CallException(
        CallErrorCode.CALL_ALREADY_ENDED,
        'This call has already ended',
      );
    }
    return call;
  }

  private assertParticipant(
    userId: number,
    callerId: number,
    receiverId: number,
  ) {
    if (userId !== callerId && userId !== receiverId) {
      throw new CallException(
        CallErrorCode.UNAUTHORIZED_CALL_ACCESS,
        'You are not a participant of this call',
      );
    }
  }

  private isTerminal(status: CallStatus) {
    return (TERMINAL_CALL_STATUSES as CallStatus[]).includes(status);
  }

  private logLifecycle(
    event: string,
    payload: Record<string, string | number | undefined>,
  ) {
    this.logger.log(JSON.stringify({ event, ...payload }));
  }
}
