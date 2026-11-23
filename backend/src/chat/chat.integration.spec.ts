import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { once } from "node:events";
import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import * as request from "supertest";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

const readBody = async (incoming: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

const writeResponse = (response: ServerResponse, status: number, body: unknown) => {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
};

describe("Chat integration", () => {
  let app: INestApplication;
  let ragServer: Server;
  let forwardedMessage: unknown;
  let ragStatus = 200;

  beforeAll(async () => {
    ragServer = createServer(async (incoming, response) => {
      const body: unknown = JSON.parse(await readBody(incoming));
      forwardedMessage = body;
      if (ragStatus !== 200) {
        writeResponse(response, ragStatus, { detail: "private RAG provider detail" });
        return;
      }
      writeResponse(response, 200, {
        answer: "Consulte as regras oficiais de cancelamento.",
        sources: ["requisitos.md"],
        suggestions: ["Como faço uma reserva?"],
      });
    });
    ragServer.listen(0, "127.0.0.1");
    await once(ragServer, "listening");
    const address = ragServer.address();
    if (!address || typeof address === "string") throw new Error("The local RAG test server did not start.");

    const module = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        ChatService,
        {
          provide: ConfigService,
          useValue: new ConfigService({ RAG_CHAT_URL: `http://127.0.0.1:${address.port}/chat` }),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    forwardedMessage = undefined;
    ragStatus = 200;
  });

  afterAll(async () => {
    await app.close();
    ragServer.close();
    await once(ragServer, "close");
  });

  it("TK-15.04 RF-34 RNF-04: encaminha pergunta pela API ao RAG e devolve fontes e sugestões", async () => {
    await request(app.getHttpServer())
      .post("/api/chat/messages")
      .send({ message: "Como funciona o cancelamento?" })
      .expect(201, {
        answer: "Consulte as regras oficiais de cancelamento.",
        topic: "rag",
        sources: ["requisitos.md"],
        suggestions: ["Como faço uma reserva?"],
      });

    expect(forwardedMessage).toEqual({ message: "Como funciona o cancelamento?" });
  });

  it("TK-15.04 RF-34 RNF-04: valida a pergunta antes do RAG e oculta falhas do serviço interno", async () => {
    await request(app.getHttpServer()).post("/api/chat/messages").send({ message: "   " }).expect(400);
    expect(forwardedMessage).toBeUndefined();

    ragStatus = 503;
    const response = await request(app.getHttpServer())
      .post("/api/chat/messages")
      .send({ message: "Pergunta válida" })
      .expect(503);

    expect(response.text).not.toContain("private RAG provider detail");
  });
});
