import { Type } from 'class-transformer';
import { IsEnum, IsInt, Min } from 'class-validator';
import { CallType } from '../types/call.types';

export class InitiateCallDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  receiverId: number;

  @IsEnum(CallType)
  callType: CallType;
}
