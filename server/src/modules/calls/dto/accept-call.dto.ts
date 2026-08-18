import { IsString } from 'class-validator';

export class AcceptCallDto {
  @IsString()
  callId: string;
}
