import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { IS_PUBLIC_KEY } from "../auth/decorators/public.decorator";
import { ChatService } from "./chat.service";
import { ChatController } from "./chat.controller";

describe("ChatController", () => {
  const response = {
    answer: "Consulte as regras oficiais.",
    topic: "rag",
    sources: ["requisitos.md"],
    suggestions: ["Como faço uma reserva?"],
  };
  const chatService = { respond: jest.fn().mockResolvedValue(response) };
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: chatService }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    chatService.respond.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  it("TK-15.02 RF-34: exposes the chat endpoint publicly", () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, ChatController.prototype.respond)).toBe(true);
  });

  it("TK-15.02 RF-34: returns the RAG answer, sources and suggestions under /api", async () => {
    await request(app.getHttpServer())
      .post("/api/chat/messages")
      .send({ message: "Como funciona o cancelamento?" })
      .expect(201, response);

    expect(chatService.respond).toHaveBeenCalledWith("Como funciona o cancelamento?");
  });

  it.each([
    ["empty", ""],
    ["whitespace-only", "   "],
    ["oversized", "x".repeat(501)],
  ])("TK-15.02 RF-34: rejects %s messages before invoking the service", async (_caseName, message) => {
    await request(app.getHttpServer()).post("/api/chat/messages").send({ message }).expect(400);

    expect(chatService.respond).not.toHaveBeenCalled();
  });

  it("TK-15.02 RF-34: rejects unexpected request properties", async () => {
    await request(app.getHttpServer())
      .post("/api/chat/messages")
      .send({ message: "Pergunta", extra: "not allowed" })
      .expect(400);

    expect(chatService.respond).not.toHaveBeenCalled();
  });
});
