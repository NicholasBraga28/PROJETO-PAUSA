import { plainToInstance } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateIf,
  validateSync,
} from "class-validator";
import { parseBusinessRules } from "./business-rules.config";

export const AUTH_MODES = ["header", "google"] as const;
export type AuthMode = (typeof AUTH_MODES)[number];

const MAX_PORT = 65_535;
const TEST_ENVIRONMENT = "test";

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  readonly DATABASE_URL!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PORT)
  readonly PORT?: number;

  @IsOptional()
  @IsString()
  readonly CORS_ORIGINS?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  readonly RAG_CHAT_URL?: string;

  @IsOptional()
  @IsIn(AUTH_MODES)
  readonly AUTH_MODE?: AuthMode;

  @ValidateIf((env: EnvironmentVariables) => env.AUTH_MODE === "google")
  @IsString()
  @IsNotEmpty()
  readonly GOOGLE_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  readonly NODE_ENV?: string;

  @ValidateIf((env: EnvironmentVariables) => env.NODE_ENV !== TEST_ENVIRONMENT)
  @IsString()
  @IsNotEmpty()
  readonly ALEXA_SKILL_ID?: string;
}

export class InvalidEnvironmentError extends Error {}

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const environment = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(environment);
  if (errors.length > 0) {
    const invalid = errors.map((error) => error.property).join(", ");
    throw new InvalidEnvironmentError(`Variáveis de ambiente inválidas: ${invalid}.`);
  }
  parseBusinessRules(config as Record<string, string | undefined>);
  return config;
}
