import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { identify, request } from "./client";
import { ApiError } from "./api-error";

const Thing = z.object({ id: z.string(), spokenText: z.string() });

function respond(status: number, data?: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(data === undefined ? null : JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe("request", () => {
  it("TK-09.03 RNF-04: devolve a resposta validada pelo esquema do contrato, sem campos fora dele", async () => {
    respond(200, { id: "a1", spokenText: "Pronto.", extra: "ignorado" });
    await expect(request("/thing", Thing)).resolves.toEqual({ id: "a1", spokenText: "Pronto." });
  });

  it("TK-09.03 RNF-04: recusa resposta fora do contrato com a mensagem genérica, sem devolver dado parcial", async () => {
    respond(200, { id: 42 });
    const error = await rejection(request("/thing", Thing));
    expect(error.message).toBe("Não foi possível ler a resposta do servidor. Tente de novo.");
  });

  it("TK-09.03: lança o erro 4xx com o texto do catálogo do backend e o status", async () => {
    respond(409, {
      statusCode: 409,
      message: "Esse horário acabou de ser reservado. Escolha outro.",
      error: "Conflict",
    });
    const error = await rejection(request("/thing", Thing));
    expect(error.message).toBe("Esse horário acabou de ser reservado. Escolha outro.");
    expect(error.status).toBe(409);
  });

  it("TK-12.03 RF-25: preserva detalhes estruturados para a tela validar conflitos com atendimentos", async () => {
    const responseBody = {
      statusCode: 409,
      message: "Não é possível alterar ou remover este período pois já existem atendimentos agendados nele.",
      appointments: [{ id: "appointment-1", employee: { id: "employee-1", name: "Ana Silva" } }],
    };
    respond(409, responseBody);
    const error = await rejection(request("/thing", Thing));
    expect(error.responseBody).toEqual(responseBody);
  });

  it("TK-09.03: junta as mensagens de validação quando o backend devolve uma lista", async () => {
    respond(400, { message: ["Informe o início.", "Informe a sala."] });
    const error = await rejection(request("/thing", Thing));
    expect(error.message).toBe("Informe o início. Informe a sala.");
  });

  it("TK-09.03: nunca mostra o corpo bruto nem só o código HTTP quando o erro não traz mensagem", async () => {
    respond(418, { detail: "teapot" });
    const error = await rejection(request("/thing", Thing));
    expect(error.message).toBe("O servidor não conseguiu atender o pedido. Tente de novo em instantes.");
    expect(error.status).toBe(418);
  });

  it("TK-09.03: troca o texto de um erro 5xx, que não vem do catálogo, pela frase genérica", async () => {
    respond(500, { statusCode: 500, message: "Internal server error" });
    const error = await rejection(request("/thing", Thing));
    expect(error.message).toBe("O servidor não conseguiu atender o pedido. Tente de novo em instantes.");
  });

  it("TK-09.03: sem rede, lança ApiError dizendo o que aconteceu e o que fazer", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await rejection(request("/thing", Thing));
    expect(error.message).toBe("Não conseguimos falar com o servidor. Verifique sua conexão e tente de novo.");
    expect(error.status).toBe(0);
  });

  it("TK-09.03: aceita 204 sem corpo quando o contrato não espera resposta", async () => {
    respond(204);
    await expect(request("/thing", z.undefined(), { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("TK-09.03: identifica quem age em toda chamada depois de identify, e para de identificar com identify(null)", async () => {
    const fetch = respond(200, { id: "a1", spokenText: "Pronto." });
    identify("u-1");
    await request("/thing", Thing);
    identify(null);
    await request("/thing", Thing);
    const headers = fetch.mock.calls.map(([, init]) => new Headers(init?.headers).get("x-user-id"));
    expect(headers).toEqual(["u-1", null]);
  });

  it("TK-09.03: recusa corpo que não é JSON com a mesma mensagem genérica", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html>", { status: 200 }));
    const error = await rejection(request("/thing", Thing));
    expect(error.message).toBe("Não foi possível ler a resposta do servidor. Tente de novo.");
  });
});
