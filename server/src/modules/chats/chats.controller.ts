import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { ChatsService } from './chats.service';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get()
  findConversation(
    @CurrentUser() user: AuthUser,
    @Query('otherUserId', ParseIntPipe) otherUserId: number,
  ) {
    return this.chatsService.getConversation(user.userId, otherUserId);
  }
}
