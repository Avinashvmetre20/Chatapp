import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class SessionDescriptionDto {
  @IsIn(['offer', 'answer', 'pranswer', 'rollback'])
  type: 'offer' | 'answer' | 'pranswer' | 'rollback';

  @IsOptional()
  @IsString()
  sdp?: string;
}

export class OfferDto {
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
