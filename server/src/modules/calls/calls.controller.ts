import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { CallsService } from './calls.service';
import { CallException } from './types/call.exception';
import { CallErrorCode } from './types/call.types';

@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get('ice-servers')
  getIceServers() {
    return { iceServers: this.callsService.getIceServers() };
  }

  @Get()
  async list(@Query('userId', ParseIntPipe) userId: number) {
    return this.callsService.listHistory(userId);
  }

  @Get(':callId')
  async findOne(
    @Query('userId', ParseIntPipe) userId: number,
    @Param('callId') callId: string,
  ) {
    try {
      return await this.callsService.getCallForUser(userId, callId);
    } catch (error) {
      this.throwHttp(error);
    }
  }

  private throwHttp(error: unknown): never {
    if (error instanceof CallException) {
      if (error.code === CallErrorCode.CALL_NOT_FOUND) {
        throw new NotFoundException({
          error: error.code,
          message: error.message,
        });
      }
      if (
        error.code === CallErrorCode.UNAUTHORIZED_CALL_ACCESS ||
        error.code === CallErrorCode.INVALID_CALL_PARTICIPANT
      ) {
        throw new ForbiddenException({
          error: error.code,
          message: error.message,
        });
      }
      throw new BadRequestException({
        error: error.code,
        message: error.message,
      });
    }
    throw error;
  }
}
