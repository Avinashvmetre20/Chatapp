import { Inject, Logger, forwardRef } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from '../auth/ws-auth.service';
import { CallsService } from '../calls/calls.service';
import { PresenceService } from '../presence/presence.service';
import { ChatsService } from './chats.service';

export type ChatPayload = {
  chat_id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  created_at: Date | string;
  status: string;
};

type SendMessagePayload = {
  receiverId: number;
  message: string;
};

type OpenConversationPayload = {
  otherUserId: number;
};

@WebSocketGateway({
  cors: {
    origin: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => ChatsService))
    private readonly chatsService: ChatsService,
    @Inject(forwardRef(() => CallsService))
    private readonly callsService: CallsService,
    private readonly presenceService: PresenceService,
    private readonly wsAuthService: WsAuthService,
  ) {}

  afterInit(server: Server) {
    server.use(async (client, next) => {
      try {
        const identity = await this.wsAuthService.authenticate(client);
        if (!identity) {
          next(new Error('Unauthorized'));
          return;
        }

        client.data.userId = identity.userId;
        client.data.sessionId = identity.sessionId;
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });
  }

  async handleConnection(client: Socket) {
    const userId = this.readUserId(client);
    if (!userId) {
      client.disconnect();
      return;
    }

    const { becameOnline } = this.presenceService.register(client, userId);

    void this.callsService.resendRingingCalls(userId);

    client.emit('presence:list', this.presenceService.getOnlineUserIds());
    if (becameOnline) {
      this.server.emit('presence', { userId, online: true });
      void this.chatsService.markDeliveredForUser(userId);
    }
  }

  handleDisconnect(client: Socket) {
    const { userId, wentOffline } = this.presenceService.unregister(client);
    if (wentOffline && userId) {
      this.server.emit('presence', { userId, online: false });
    }
  }

  @SubscribeMessage('message:send')
  async handleSend(
    @MessageBody() payload: SendMessagePayload,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.readUserId(client);
    if (!userId) {
      return { error: 'Unauthorized' };
    }

    const receiverId = Number(payload?.receiverId);
    const message = payload?.message?.trim();
    if (!Number.isFinite(receiverId) || receiverId < 1 || !message) {
      return { error: 'Invalid message' };
    }

    try {
      return await this.chatsService.sendMessage(userId, {
        receiverId,
        message,
      });
    } catch (error) {
      this.logger.warn(
        `message:send failed for user ${userId}: ${this.errorMessage(error)}`,
      );
      return { error: this.errorMessage(error) };
    }
  }

  @SubscribeMessage('conversation:open')
  async handleOpenConversation(
    @MessageBody() payload: OpenConversationPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.readUserId(client);
    if (!userId) {
      return { error: 'Unauthorized' };
    }

    const otherUserId = Number(payload?.otherUserId);
    if (!Number.isFinite(otherUserId) || otherUserId < 1) {
      return { error: 'Invalid conversation' };
    }

    try {
      return await this.chatsService.getConversation(userId, otherUserId);
    } catch (error) {
      this.logger.warn(
        `conversation:open failed for user ${userId}: ${this.errorMessage(error)}`,
      );
      return { error: this.errorMessage(error) };
    }
  }

  @SubscribeMessage('conversation:seen')
  async handleConversationSeen(
    @MessageBody() payload: OpenConversationPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.readUserId(client);
    if (!userId) {
      return { error: 'Unauthorized' };
    }

    const otherUserId = Number(payload?.otherUserId);
    if (!Number.isFinite(otherUserId) || otherUserId < 1) {
      return { error: 'Invalid conversation' };
    }

    try {
      await this.chatsService.markSeen(userId, otherUserId);
      return { ok: true };
    } catch (error) {
      this.logger.warn(
        `conversation:seen failed for user ${userId}: ${this.errorMessage(error)}`,
      );
      return { error: this.errorMessage(error) };
    }
  }

  isOnline(userId: number) {
    return this.presenceService.isOnline(userId);
  }

  emitMessage(chat: ChatPayload) {
    this.server.to(`user:${chat.receiver_id}`).emit('message', chat);
  }

  emitStatus(payload: {
    chat_id: number;
    sender_id: number;
    status: string;
  }) {
    this.server.to(`user:${payload.sender_id}`).emit('message:status', payload);
  }

  private readUserId(client: Socket) {
    const userId = Number(client.data.userId);
    if (!Number.isFinite(userId) || userId < 1) {
      return null;
    }
    return userId;
  }

  private errorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return 'Request failed';
  }
}
