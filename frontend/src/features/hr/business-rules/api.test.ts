import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBusinessRules, updateBusinessRule } from "./api";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/shared/api/client", () => ({ request }));

const rule = {
  key: "SESSION_DURATION_MINUTES",
  value: "20",
  type: "MINUTES",
  description: "Duração de cada sessão, em minutos.",
};

describe("API dos parâmetros de negócio", () => {
  beforeEach(() => request.mockReset());

  it("TK-12.05 RF-27: consulta regras com valor, tipo e descrição validados", async () => {
    request.mockResolvedValue([rule]);

    await expect(getBusinessRules()).resolves.toEqual([rule]);
    expect(request).toHaveBeenCalledWith("/business-rules", expect.anything());
  });

  it("TK-12.05 RF-27: atualiza uma chave enviando o valor em texto e valida a resposta", async () => {
    request.mockResolvedValue({ ...rule, value: "30" });

    await expect(updateBusinessRule(rule.key, "30")).resolves.toEqual({ ...rule, value: "30" });
    expect(request).toHaveBeenCalledWith(`/business-rules/${rule.key}`, expect.anything(), {
      method: "PATCH",
      body: { value: "30" },
    });
  });
});
