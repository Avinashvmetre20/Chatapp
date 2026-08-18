import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class IceCandidateInitDto {
  @IsOptional()
  @IsString()
  candidate?: string | null;

  @IsOptional()
  @IsString()
  sdpMid?: string | null;

  @IsOptional()
  @IsNumber()
  sdpMLineIndex?: number | null;

  @IsOptional()
  @IsString()
  usernameFragment?: string | null;
}

export class IceCandidateDto {
  @IsString()
  callId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  receiverId: number;

  @ValidateNested()
  @Type(() => IceCandidateInitDto)
  candidate: IceCandidateInitDto;
}
