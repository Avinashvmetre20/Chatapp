import { IsString } from 'class-validator';

export class RejectCallDto {
  @IsString()
  callId: string;
}
