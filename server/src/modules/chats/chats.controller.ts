import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ChatsService } from './chats.service';
import { CreateChatDto } from './dto/create-chat.dto';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Post()
  create(@Body() dto: CreateChatDto) {
    return this.chatsService.create(dto);
  }

  @Get()
  findConversation(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('otherUserId', ParseIntPipe) otherUserId: number,
  ) {
    return this.chatsService.findConversation(userId, otherUserId);
  }
}
