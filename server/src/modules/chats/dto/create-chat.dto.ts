import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateChatDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  senderId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  receiverId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;
}
