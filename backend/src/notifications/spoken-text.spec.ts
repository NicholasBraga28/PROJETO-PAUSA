import { messages } from "../messages/catalog";
import {
  appointmentStatusOf,
  atTimeOf,
  calendarDateOf,
  countOf,
  dayOf,
  firstNameOf,
  fromTimeOf,
  intervalOf,
  spokenTextOf,
  whenOf,
} from "./spoken-text";

describe("spoken text", () => {
  describe("atTimeOf", () => {
    it("TK-06.01 RNF-01: says a full hour in São Paulo time", () => {
      expect(atTimeOf(new Date("2026-10-23T17:00:00.000Z"))).toBe("às 14h");
    });

    it("TK-06.01 RNF-01: says the minutes after the hour, with two digits", () => {
      expect(atTimeOf(new Date("2026-10-23T12:30:00.000Z"))).toBe("às 9h30");
      expect(atTimeOf(new Date("2026-10-23T16:05:00.000Z"))).toBe("às 13h05");
    });

    it("TK-06.01 RNF-01: uses the singular preposition for one o'clock and midnight", () => {
      expect(atTimeOf(new Date("2026-10-23T04:00:00.000Z"))).toBe("à 1h");
      expect(atTimeOf(new Date("2026-10-23T03:00:00.000Z"))).toBe("à 0h");
      expect(atTimeOf(new Date("2026-10-23T04:15:00.000Z"))).toBe("à 1h15");
    });

    it("TK-06.01 RNF-05: uses São Paulo time near local midnight", () => {
      expect(atTimeOf(new Date("2026-10-24T02:30:00.000Z"))).toBe("às 23h30");
    });

    it("TK-06.01 RNF-01: never says the time as digits with a colon or as ISO", () => {
      const spoken = atTimeOf(new Date("2026-10-23T17:00:00.000Z"));
      expect(spoken).not.toMatch(/\d:\d|T\d|Z$|UTC/);
    });
  });

  describe("fromTimeOf", () => {
    it("TK-06.01 RNF-01: names an appointment by its start time", () => {
      expect(fromTimeOf(new Date("2026-10-23T17:00:00.000Z"))).toBe("das 14h");
      expect(fromTimeOf(new Date("2026-10-23T04:30:00.000Z"))).toBe("da 1h30");
    });
  });

  describe("intervalOf", () => {
    it("TK-06.01 RNF-01: says the start and the end of a period", () => {
      expect(intervalOf(new Date("2026-10-23T18:00:00.000Z"), new Date("2026-10-23T19:00:00.000Z"))).toBe(
        "das 15h às 16h",
      );
    });

    it("TK-06.01 RNF-01: uses the singular preposition at the edges of one o'clock", () => {
      expect(intervalOf(new Date("2026-10-23T04:00:00.000Z"), new Date("2026-10-23T05:30:00.000Z"))).toBe(
        "da 1h às 2h30",
      );
      expect(intervalOf(new Date("2026-10-23T03:00:00.000Z"), new Date("2026-10-23T04:00:00.000Z"))).toBe("da 0h à 1h");
    });
  });

  describe("dayOf", () => {
    const now = new Date("2026-10-23T15:00:00.000Z");

    it("TK-06.01 RNF-01: omits the day when it is today", () => {
      expect(dayOf(new Date("2026-10-23T22:00:00.000Z"), now)).toBe("");
    });

    it("TK-06.01 RNF-01: says tomorrow for the next local day", () => {
      expect(dayOf(new Date("2026-10-24T12:00:00.000Z"), now)).toBe("amanhã");
    });

    it("TK-06.01 RNF-01: says the weekday, day and month in full for other days", () => {
      expect(dayOf(new Date("2026-10-26T12:00:00.000Z"), now)).toBe("na segunda-feira, 26 de outubro");
      expect(dayOf(new Date("2026-10-25T12:00:00.000Z"), now)).toBe("no domingo, 25 de outubro");
      expect(dayOf(new Date("2026-10-22T12:00:00.000Z"), now)).toBe("na quinta-feira, 22 de outubro");
      expect(dayOf(new Date("2026-11-01T12:00:00.000Z"), now)).toBe("no domingo, 1º de novembro");
    });

    it("TK-06.01 RNF-05: uses the São Paulo day near local midnight", () => {
      const lateEvening = new Date("2026-10-24T02:30:00.000Z");
      expect(dayOf(lateEvening, now)).toBe("");
      expect(dayOf(new Date("2026-10-24T12:00:00.000Z"), lateEvening)).toBe("amanhã");
    });
  });

  describe("calendarDateOf", () => {
    it("MSG-07: says the local day and month, with the ordinal on the first day", () => {
      expect(calendarDateOf(new Date("2026-10-23T17:15:00.000Z"))).toBe("23 de outubro");
      expect(calendarDateOf(new Date("2026-11-01T12:00:00.000Z"))).toBe("1º de novembro");
      expect(calendarDateOf(new Date("2026-11-01T02:30:00.000Z"))).toBe("31 de outubro");
    });
  });

  describe("firstNameOf", () => {
    it("TK-06.01 RNF-04: says only the first name of a full name with extra spaces", () => {
      expect(firstNameOf("  Ana   Souza Lima ")).toBe("Ana");
    });
  });

  describe("countOf", () => {
    it("TK-06.01 RNF-01: uses the singular only for one", () => {
      expect(countOf(0, messages.speech.nouns.appointment)).toBe("0 atendimentos");
      expect(countOf(1, messages.speech.nouns.appointment)).toBe("1 atendimento");
      expect(countOf(2, messages.speech.nouns.appointment)).toBe("2 atendimentos");
    });
  });

  describe("appointmentStatusOf", () => {
    it("TK-06.01 RNF-01: says each agenda status in Portuguese", () => {
      expect(appointmentStatusOf("CONFIRMED")).toBe("confirmado");
      expect(appointmentStatusOf("CHECKED_IN")).toBe("chegou");
      expect(appointmentStatusOf("POSSIBLE_NO_SHOW")).toBe("possível ausência");
      expect(appointmentStatusOf("IN_PROGRESS")).toBe("em andamento");
      expect(appointmentStatusOf("COMPLETED")).toBe("concluído");
      expect(appointmentStatusOf("NO_SHOW")).toBe("ausente");
    });
  });

  describe("whenOf", () => {
    const now = new Date("2026-10-23T15:00:00.000Z");

    it("TK-06.01 RNF-01: says only the time when the day is today", () => {
      expect(whenOf(new Date("2026-10-23T17:00:00.000Z"), now)).toBe("às 14h");
    });

    it("TK-06.01 RNF-01: says the day before the time on other days", () => {
      expect(whenOf(new Date("2026-10-24T12:00:00.000Z"), now)).toBe("amanhã às 9h");
      expect(whenOf(new Date("2026-10-26T04:00:00.000Z"), now)).toBe("na segunda-feira, 26 de outubro, à 1h");
    });
  });

  describe("spokenTextOf", () => {
    const now = new Date("2026-10-23T15:00:00.000Z");
    const sentencesOf = (text: string) => text.match(/[^.?!]+[.?!]/g) ?? [];

    it("TK-06.01 RNF-01: ends each sentence with a period and starts it with a capital letter", () => {
      expect(spokenTextOf(["sessão finalizada", "próximo: Bruno, às 15h"])).toBe(
        "Sessão finalizada. Próximo: Bruno, às 15h.",
      );
    });

    it("TK-06.01 RNF-01: keeps the punctuation a sentence already has", () => {
      expect(spokenTextOf(["Cancelar o atendimento de Ana às 14h.", "Confirma?"])).toBe(
        "Cancelar o atendimento de Ana às 14h. Confirma?",
      );
    });

    it("TK-06.01 RNF-01: trims and collapses the spaces left by an omitted day", () => {
      expect(spokenTextOf([`  ${dayOf(now, now)} ${atTimeOf(now)}  com   Ana `])).toBe("Às 12h com Ana.");
    });

    it("TK-06.01 RNF-01 RNF-04: composes at most two sentences without surname, e-mail, ID, ISO or UTC", () => {
      const startsAt = new Date("2026-10-26T18:00:00.000Z");
      const text = spokenTextOf([
        `Você tem ${countOf(2, messages.speech.nouns.appointment)}`,
        `primeiro: ${firstNameOf("Ana Souza")}, ${whenOf(startsAt, now)}, ${appointmentStatusOf("CONFIRMED")}`,
      ]);

      expect(text).toBe("Você tem 2 atendimentos. Primeiro: Ana, na segunda-feira, 26 de outubro, às 15h, confirmado.");
      expect(sentencesOf(text)).toHaveLength(2);
      expect(text).not.toMatch(/Souza|@|\d{4}-\d{2}|\d:\d|T\d{2}|UTC|[0-9a-f]{8}-/);
    });
  });
});
