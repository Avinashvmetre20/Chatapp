import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateChatDto } from './dto/create-chat.dto';

type ChatMasterRow = {
  chat_id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  created_at: Date;
};

type UserIdRow = {
  user_id: number;
};

@Injectable()
export class ChatsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(dto: CreateChatDto): Promise<ChatMasterRow> {
    if (dto.senderId === dto.receiverId) {
      throw new BadRequestException('Cannot send a message to yourself');
    }

    await this.assertUserExists(dto.senderId);
    await this.assertUserExists(dto.receiverId);

    const result = await this.databaseService.query<ChatMasterRow>(
      `INSERT INTO chat_master (sender_id, receiver_id, message)
       VALUES ($1, $2, $3)
       RETURNING chat_id, sender_id, receiver_id, message, created_at`,
      [dto.senderId, dto.receiverId, dto.message],
    );

    return result.rows[0];
  }

  async findConversation(
    userId: number,
    otherUserId: number,
  ): Promise<ChatMasterRow[]> {
    const result = await this.databaseService.query<ChatMasterRow>(
      `SELECT chat_id, sender_id, receiver_id, message, created_at
       FROM chat_master
       WHERE (sender_id = $1 AND receiver_id = $2)
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [userId, otherUserId],
    );

    return result.rows;
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
