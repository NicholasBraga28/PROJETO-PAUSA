import { ServiceUnavailableException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { messages } from "../messages/catalog";

interface RagChatResponse {
  answer?: unknown;
  sources?: unknown;
  suggestions?: unknown;
}

const isRecord = (value: unknown): value is RagChatResponse => typeof value === "object" && value !== null;
const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

@Injectable()
export class ChatService {
  private readonly ragUrl: string;

  constructor(config: ConfigService) {
    this.ragUrl = config.get<string>("RAG_CHAT_URL") ?? "http://127.0.0.1:8000/chat";
  }

  async respond(message: string) {
    let response: Response;
    try {
      response = await fetch(this.ragUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new ServiceUnavailableException(messages.chat.unavailable);
    }

    if (!response.ok) throw new ServiceUnavailableException(messages.chat.unavailable);

    const body: unknown = await response.json().catch(() => null);
    if (!isRecord(body) || typeof body.answer !== "string" || !body.answer.trim()) {
      throw new ServiceUnavailableException(messages.chat.unavailable);
    }

    return {
      answer: body.answer.trim(),
      topic: "rag" as const,
      sources: stringList(body.sources),
      suggestions: stringList(body.suggestions),
    };
  }
}
