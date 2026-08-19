import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { ChatGateway } from './chat.gateway';

export type ChatMasterRow = {
  chat_id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  created_at: Date;
  status: string;
};

type UserIdRow = {
  user_id: number;
};

@Injectable()
export class ChatsService {
  constructor(
    private readonly databaseService: DatabaseService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async sendMessage(dto: CreateChatDto): Promise<ChatMasterRow> {
    await this.assertUserExists(dto.senderId);

    if (dto.senderId !== dto.receiverId) {
      await this.assertUserExists(dto.receiverId);
    }

    const result = await this.databaseService.query<ChatMasterRow>(
      `INSERT INTO chat_master (sender_id, receiver_id, message, status)
       VALUES ($1, $2, $3, 'sent')
       RETURNING chat_id, sender_id, receiver_id, message, created_at, status`,
      [dto.senderId, dto.receiverId, dto.message],
    );

    let chat = result.rows[0];

    if (
      dto.senderId !== dto.receiverId &&
      this.chatGateway.isOnline(dto.receiverId)
    ) {
      chat = await this.markDelivered(chat.chat_id);
      this.chatGateway.emitMessage(chat);
    }

    return chat;
  }

  async getConversation(
    userId: number,
    otherUserId: number,
  ): Promise<ChatMasterRow[]> {
    await this.markRead(userId, otherUserId);

    const result = await this.databaseService.query<ChatMasterRow>(
      `SELECT chat_id, sender_id, receiver_id, message, created_at, status
       FROM chat_master
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [userId, otherUserId],
    );

    return result.rows;
  }

  async markSeen(userId: number, otherUserId: number) {
    await this.markRead(userId, otherUserId);
  }

  async markDeliveredForUser(userId: number) {
    const rows = await this.databaseService.query<ChatMasterRow>(
      `UPDATE chat_master
       SET status = 'delivered'
       WHERE receiver_id = $1
         AND status = 'sent'
       RETURNING chat_id, sender_id, receiver_id, message, created_at, status`,
      [userId],
    );

    for (const chat of rows.rows) {
      this.chatGateway.emitStatus({
        chat_id: chat.chat_id,
        sender_id: chat.sender_id,
        status: 'delivered',
      });
    }
  }

  private async markDelivered(chatId: number): Promise<ChatMasterRow> {
    const result = await this.databaseService.query<ChatMasterRow>(
      `UPDATE chat_master
       SET status = 'delivered'
       WHERE chat_id = $1
       RETURNING chat_id, sender_id, receiver_id, message, created_at, status`,
      [chatId],
    );

    const chat = result.rows[0];
    this.chatGateway.emitStatus({
      chat_id: chat.chat_id,
      sender_id: chat.sender_id,
      status: 'delivered',
    });
    return chat;
  }

  private async markRead(receiverId: number, senderId: number) {
    const delivered = await this.databaseService.query<ChatMasterRow>(
      `UPDATE chat_master
       SET status = 'delivered'
       WHERE receiver_id = $1
         AND sender_id = $2
         AND status = 'sent'
       RETURNING chat_id, sender_id, receiver_id, message, created_at, status`,
      [receiverId, senderId],
    );

    for (const chat of delivered.rows) {
      this.chatGateway.emitStatus({
        chat_id: chat.chat_id,
        sender_id: chat.sender_id,
        status: 'delivered',
      });
    }

    const read = await this.databaseService.query<ChatMasterRow>(
      `UPDATE chat_master
       SET status = 'read'
       WHERE receiver_id = $1
         AND sender_id = $2
         AND status = 'delivered'
       RETURNING chat_id, sender_id, receiver_id, message, created_at, status`,
      [receiverId, senderId],
    );

    for (const chat of read.rows) {
      this.chatGateway.emitStatus({
        chat_id: chat.chat_id,
        sender_id: chat.sender_id,
        status: 'read',
      });
    }
  }

  private async assertUserExists(userId: number) {
    const result = await this.databaseService.query<UserIdRow>(
      `SELECT user_id FROM user_master WHERE user_id = $1`,
      [userId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(`User ${userId} not found`);
    }
  }
}
