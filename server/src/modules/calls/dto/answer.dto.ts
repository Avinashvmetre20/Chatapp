import { Type } from 'class-transformer';
import { IsInt, Min, ValidateNested, IsString } from 'class-validator';
import { SessionDescriptionDto } from './offer.dto';

export class AnswerDto {
  @IsString()
  callId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  receiverId: number;

  @ValidateNested()
  @Type(() => SessionDescriptionDto)
  sdp: SessionDescriptionDto;
}
