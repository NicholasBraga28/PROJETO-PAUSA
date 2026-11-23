import { ConfigService } from "@nestjs/config";
import { ServiceUnavailableException } from "@nestjs/common";
import { messages } from "../messages/catalog";
import { ChatService } from "./chat.service";

describe("ChatService", () => {
  const ragUrl = "http://127.0.0.1:8000/chat";
  let service: ChatService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new ChatService(new ConfigService({ RAG_CHAT_URL: ragUrl }));
    fetchSpy = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("TK-15.02 RF-34 RNF-04: forwards the question and returns the validated RAG fields", async () => {
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify({
          answer: "Consulte as regras de cancelamento.",
          sources: ["requisitos.md", 7, "CONTEXT.md"],
          suggestions: ["Como faço uma reserva?", null],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(service.respond("Como funciona o cancelamento?")).resolves.toEqual({
      answer: "Consulte as regras de cancelamento.",
      topic: "rag",
      sources: ["requisitos.md", "CONTEXT.md"],
      suggestions: ["Como faço uma reserva?"],
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      ragUrl,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Como funciona o cancelamento?" }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it("TK-15.02 RF-34: uses the documented local RAG URL when no URL is configured", async () => {
    const unconfigured = new ChatService(new ConfigService({}));
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ answer: "Resposta", sources: [], suggestions: [] }), { status: 200 }),
    );

    await unconfigured.respond("Pergunta");

    expect(fetchSpy).toHaveBeenCalledWith("http://127.0.0.1:8000/chat", expect.any(Object));
  });

  it("TK-15.02 RF-34: converts network and timeout failures to the public unavailable message", async () => {
    fetchSpy.mockRejectedValue(new Error("private network detail"));

    const result = service.respond("Pergunta");

    await expect(result).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(result).rejects.toThrow(messages.chat.unavailable);
  });

  it("TK-15.02 RF-34: converts non-success responses to service unavailable", async () => {
    fetchSpy.mockResolvedValue(new Response("private provider detail", { status: 500 }));

    await expect(service.respond("Pergunta")).rejects.toThrow(messages.chat.unavailable);
  });

  it.each([
    ["missing JSON", undefined],
    ["invalid JSON", "not-json"],
    ["missing answer", JSON.stringify({ sources: [], suggestions: [] })],
    ["non-string answer", JSON.stringify({ answer: 4 })],
    ["empty answer", JSON.stringify({ answer: "   " })],
  ])("TK-15.02 RF-34: rejects %s from the RAG contract", async (_caseName, body) => {
    fetchSpy.mockResolvedValue(new Response(body, { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(service.respond("Pergunta")).rejects.toThrow(messages.chat.unavailable);
  });
});
