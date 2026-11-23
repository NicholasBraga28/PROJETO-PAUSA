import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { identify } from "@/shared/api/client";
import { sendChatMessage } from "./api";

describe("sendChatMessage", () => {
  beforeEach(() => {
    identify("demo-user-id");
  });

  afterEach(() => {
    identify(null);
  });

  it("TK-15.03 RF-34 RNF-04: envia somente a pergunta sem identificar a pessoa", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ answer: "Resposta", topic: "rag", sources: ["requisitos.md"], suggestions: [] }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        ),
      );

    await expect(sendChatMessage("Como faço uma reserva?")).resolves.toEqual({
      answer: "Resposta",
      topic: "rag",
      sources: ["requisitos.md"],
      suggestions: [],
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/chat/messages",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Como faço uma reserva?" }),
      }),
    );
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).has("x-user-id")).toBe(false);
  });
});
