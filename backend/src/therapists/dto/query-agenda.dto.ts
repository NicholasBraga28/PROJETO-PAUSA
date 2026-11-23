import { IsOptional, IsString } from "class-validator";

export class QueryAgendaDto {
  @IsOptional()
  @IsString()
  readonly date?: string;
}
