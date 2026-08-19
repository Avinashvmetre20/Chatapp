import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PresenceModule } from '../presence/presence.module';
import { ChatGateway } from './chat.gateway';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';

@Module({
  imports: [DatabaseModule, PresenceModule, AuthModule],
  controllers: [ChatsController],
  providers: [ChatGateway, ChatsService],
})
export class ChatsModule {}
