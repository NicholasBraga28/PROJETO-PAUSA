import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class SendChatMessageDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message!: string;
}
