import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { ChatsService } from './chats.service';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get()
  findConversation(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('otherUserId', ParseIntPipe) otherUserId: number,
  ) {
    return this.chatsService.getConversation(userId, otherUserId);
  }
}
