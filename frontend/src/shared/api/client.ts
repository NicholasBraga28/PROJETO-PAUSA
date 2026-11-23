import { z } from "zod";
import { ApiError, INVALID_RESPONSE, OFFLINE, UNEXPECTED } from "./api-error";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

const NestErrorBody = z.object({ message: z.union([z.string().min(1), z.array(z.string()).min(1)]) });

function apiErrorFrom(status: number, body: unknown) {
  const parsed = NestErrorBody.safeParse(body);
  if (status >= 500 || !parsed.success) return new ApiError(UNEXPECTED, status);
  const { message } = parsed.data;
  return new ApiError(Array.isArray(message) ? message.join(" ") : message, status, body);
}

let currentUserId: string | null = null;
export const identify = (userId: string | null) => {
  currentUserId = userId;
};

interface RequestOptions {
  method?: string;
  body?: object;
  includeUserId?: boolean;
}

export async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  { body, includeUserId = true, ...init }: RequestOptions = {},
): Promise<z.infer<S>> {
  const response = await fetch(BASE + path, {
    ...init,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(includeUserId && currentUserId ? { "x-user-id": currentUserId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => {
    throw new ApiError(OFFLINE, 0);
  });
  const data: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw apiErrorFrom(response.status, data);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new ApiError(INVALID_RESPONSE, response.status);
  return parsed.data;
}
