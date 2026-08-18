import { Inject, forwardRef } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WsAuthService } from '../auth/ws-auth.service';
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
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => ChatsService))
    private readonly chatsService: ChatsService,
    private readonly presenceService: PresenceService,
    private readonly wsAuthService: WsAuthService,
  ) {}

  async handleConnection(client: Socket) {
    const identity = await this.wsAuthService.authenticate(client);
    if (!identity) {
      client.disconnect();
      return;
    }

    const userId = identity.userId;
    client.data.userId = userId;
    client.data.sessionId = identity.sessionId;

    const { becameOnline } = this.presenceService.register(client, userId);

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
    const userId = this.requireUserId(client);
    const chat = await this.chatsService.sendMessage(userId, payload);
    return chat;
  }

  @SubscribeMessage('conversation:open')
  async handleOpenConversation(
    @MessageBody() payload: OpenConversationPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.requireUserId(client);
    return this.chatsService.getConversation(userId, payload.otherUserId);
  }

  @SubscribeMessage('conversation:seen')
  async handleConversationSeen(
    @MessageBody() payload: OpenConversationPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const userId = this.requireUserId(client);
    await this.chatsService.markSeen(userId, payload.otherUserId);
    return { ok: true };
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

  private requireUserId(client: Socket) {
    const userId = Number(client.data.userId);
    if (!Number.isFinite(userId) || userId < 1) {
      throw new Error('Unauthorized');
    }
    return userId;
  }
}
