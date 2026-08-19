import { Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('heartbeat')
  heartbeat(@CurrentUser() user: AuthUser) {
    return this.usersService.heartbeat(user.userId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.usersService.findAll(user.userId);
  }
}
