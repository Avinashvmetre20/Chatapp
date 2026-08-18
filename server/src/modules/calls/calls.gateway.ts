import { Inject, forwardRef } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { AcceptCallDto } from './dto/accept-call.dto';
import { AnswerDto } from './dto/answer.dto';
import { EndCallDto } from './dto/end-call.dto';
import { IceCandidateDto } from './dto/ice-candidate.dto';
import { InitiateCallDto } from './dto/initiate-call.dto';
import { OfferDto } from './dto/offer.dto';
import { RejectCallDto } from './dto/reject-call.dto';
import { CallsService } from './calls.service';
import { CallException } from './types/call.exception';
import { CallErrorCode } from './types/call.types';

type ClassType<T> = new () => T;

@WebSocketGateway({
  cors: {
    origin: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  },
})
export class CallsGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => CallsService))
    private readonly callsService: CallsService,
  ) {}

  emitToUser(userId: number, event: string, payload: object) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  @SubscribeMessage('call:initiate')
  async handleInitiate(
    @MessageBody() payload: InitiateCallDto,
    @ConnectedSocket() client: Socket,
  ) {
    return this.handle(client, payload, InitiateCallDto, (userId, dto) =>
      this.callsService.initiate(userId, dto.receiverId, dto.callType),
    );
  }

  @SubscribeMessage('call:accept')
  async handleAccept(
    @MessageBody() payload: AcceptCallDto,
    @ConnectedSocket() client: Socket,
  ) {
    return this.handle(client, payload, AcceptCallDto, (userId, dto) =>
      this.callsService.accept(userId, dto.callId),
    );
  }

  @SubscribeMessage('call:reject')
  async handleReject(
    @MessageBody() payload: RejectCallDto,
    @ConnectedSocket() client: Socket,
  ) {
    return this.handle(client, payload, RejectCallDto, (userId, dto) =>
      this.callsService.reject(userId, dto.callId),
    );
  }

  @SubscribeMessage('call:offer')
  async handleOffer(
    @MessageBody() payload: OfferDto,
    @ConnectedSocket() client: Socket,
  ) {
    return this.handle(client, payload, OfferDto, async (userId, dto) => {
      await this.callsService.forwardOffer(userId, dto.callId, dto.sdp);
      return { ok: true };
    });
  }

  @SubscribeMessage('call:answer')
  async handleAnswer(
    @MessageBody() payload: AnswerDto,
    @ConnectedSocket() client: Socket,
  ) {
    return this.handle(client, payload, AnswerDto, async (userId, dto) => {
      await this.callsService.forwardAnswer(userId, dto.callId, dto.sdp);
      return { ok: true };
    });
  }

  @SubscribeMessage('call:ice-candidate')
  async handleIceCandidate(
    @MessageBody() payload: IceCandidateDto,
    @ConnectedSocket() client: Socket,
  ) {
    return this.handle(client, payload, IceCandidateDto, async (userId, dto) => {
      await this.callsService.forwardIceCandidate(
        userId,
        dto.callId,
        dto.candidate,
      );
      return { ok: true };
    });
  }

  @SubscribeMessage('call:end')
  async handleEnd(
    @MessageBody() payload: EndCallDto,
    @ConnectedSocket() client: Socket,
  ) {
    return this.handle(client, payload, EndCallDto, (userId, dto) =>
      this.callsService.end(userId, dto.callId),
    );
  }

  private async handle<T extends object, R>(
    client: Socket,
    payload: unknown,
    dtoClass: ClassType<T>,
    action: (userId: number, dto: T) => Promise<R>,
  ) {
    try {
      const userId = this.requireUserId(client);
      const dto = await this.parseDto(dtoClass, payload);
      return await action(userId, dto);
    } catch (error) {
      if (error instanceof CallException) {
        return { error: error.code, message: error.message };
      }
      return {
        error: CallErrorCode.INVALID_PAYLOAD,
        message: error instanceof Error ? error.message : 'Call request failed',
      };
    }
  }

  private requireUserId(client: Socket) {
    const userId = Number(client.data.userId);
    if (!Number.isFinite(userId) || userId < 1) {
      throw new CallException(
        CallErrorCode.UNAUTHORIZED_CALL_ACCESS,
        'Socket is not authenticated',
      );
    }
    return userId;
  }

  private async parseDto<T extends object>(
    dtoClass: ClassType<T>,
    payload: unknown,
  ): Promise<T> {
    const instance = plainToInstance(dtoClass, payload);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      throw new CallException(
        CallErrorCode.INVALID_PAYLOAD,
        'Invalid call payload',
      );
    }
    return instance;
  }
}
