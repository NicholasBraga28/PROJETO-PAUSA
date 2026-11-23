import { describe, it, expect } from "vitest";
import type { AvailableSlot, Location } from "@/shared/api/schemas";
import { freeStarts, freeSlotsLabel, pickSlot, filterSlots, dayRange, locationsOf } from "./slots";

const at = (h: number, m: number) => new Date(Date.UTC(2026, 9, 26, h + 3, m)).toISOString();
const SP: Location = { id: "l1", code: "SAO_PAULO", name: "São Paulo", timezone: "America/Sao_Paulo" };
const LD: Location = { id: "l2", code: "LONDRINA", name: "Londrina", timezone: "America/Sao_Paulo" };
const slot = (h: number, m: number, therapistId: string, location = SP): AvailableSlot => ({
  startsAt: at(h, m),
  endsAt: at(h, m + 20),
  therapistId,
  therapistName: therapistId,
  roomId: "sala",
  roomName: "Sala 1",
  location,
});
const slots = [slot(9, 0, "t1"), slot(9, 0, "t2"), slot(9, 20, "t2"), slot(13, 40, "t1"), slot(17, 40, "t3", LD)];
const day = "2026-10-26";

describe("slots: leitura dos horários livres do RF-01 (TK-09.01; 2026-10-26, segunda-feira, São Paulo em UTC-3)", () => {
  it("não repete horário com vários terapeutas", () => {
    expect(freeStarts(day, slots)).toEqual([540, 560, 820, 1060]);
  });

  it("devolve lista vazia em dia sem horários", () => {
    expect(freeStarts("2026-10-25", slots)).toEqual([]);
  });

  it("filtra pelo terapeuta", () => {
    expect(freeStarts(day, filterSlots(slots, { therapist: "t1" }))).toEqual([540, 820]);
  });

  it("filtra pela unidade", () => {
    expect(freeStarts(day, filterSlots(slots, { location: "LONDRINA" }))).toEqual([1060]);
  });

  it("sem preferência pega quem está livre", () => {
    expect(pickSlot(day, 560, slots)?.therapistId).toBe("t2");
  });

  it("não acha slot quando o terapeuta escolhido está ocupado no horário", () => {
    expect(pickSlot(day, 560, filterSlots(slots, { therapist: "t1" }))).toBeNull();
  });

  it("cobre na barra do dia os horários devolvidos", () => {
    expect(dayRange(day, slots)).toEqual([9, 18]);
  });

  it("não desenha barra em dia sem horários", () => {
    expect(dayRange("2026-10-25", slots)).toBeNull();
  });

  it("lista as unidades sem repetir", () => {
    expect(locationsOf(slots).map((l) => l.code)).toEqual(["SAO_PAULO", "LONDRINA"]);
  });
});

describe("freeSlotsLabel: vagas do dia na faixa de dias (TK-10.02; RF-01)", () => {
  it.each([
    [0, "sem vagas"],
    [1, "1 livre"],
    [2, "2 livres"],
  ])("TK-10.02 RF-01: com %i vaga(s), mostra %s", (count, label) => {
    expect(freeSlotsLabel(count)).toBe(label);
  });
});
