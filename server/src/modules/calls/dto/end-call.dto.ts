import { IsString } from 'class-validator';

export class EndCallDto {
  @IsString()
  callId: string;
}
