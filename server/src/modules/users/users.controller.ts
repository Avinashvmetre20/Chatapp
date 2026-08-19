import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SignInDto } from './dto/sign-in.dto';
import { HeartbeatDto } from './dto/heartbeat.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Post('login')
  signIn(@Body() dto: SignInDto) {
    return this.usersService.signIn(dto);
  }

  @Post('heartbeat')
  heartbeat(@Body() dto: HeartbeatDto) {
    return this.usersService.heartbeat(dto.userId);
  }

  @Get()
  findAll(@Query('userId') userId?: string) {
    const viewerId = userId ? Number(userId) : undefined;
    return this.usersService.findAll(
      viewerId && Number.isFinite(viewerId) ? viewerId : undefined,
    );
  }
}
