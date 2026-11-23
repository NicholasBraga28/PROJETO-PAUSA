import { describe, expect, it } from "vitest";
import { inputTypeFor, labelFor, unitFor } from "./rule-format";

describe("formatação dos parâmetros por tipo", () => {
  it("TK-12.05 RF-27: escolhe controles tipados sem definir valores de negócio", () => {
    expect(inputTypeFor("MINUTES")).toBe("number");
    expect(inputTypeFor("DAYS")).toBe("number");
    expect(inputTypeFor("COUNT")).toBe("number");
    expect(inputTypeFor("TIME_OF_DAY")).toBe("time");
    expect(inputTypeFor("WEEKDAYS")).toBe("text");
  });

  it("TK-12.05 RF-27: apresenta unidades em texto de acordo com o tipo", () => {
    expect(unitFor("MINUTES")).toBe("minutos");
    expect(unitFor("DAYS")).toBe("dias");
    expect(unitFor("COUNT")).toBe("unidades");
    expect(unitFor("TIME_OF_DAY")).toBe("horário local");
    expect(unitFor("WEEKDAYS")).toBe("dias da semana");
  });

  it("TK-12.05 RF-27: traduz chaves conhecidas e torna compreensível uma chave futura", () => {
    expect(labelFor("SESSION_DURATION_MINUTES")).toBe("Duração da sessão");
    expect(labelFor("NEW_RULE_KEY")).toBe("Configuração de atendimento");
  });
});
