import {
  arrivalsSpeechOf,
  fullAgendaSpeechOf,
  nextAppointmentSpeechOf,
  todaySummarySpeechOf,
} from "./therapist-agenda-speech";

const SENTENCE = /[^.?!]+[.?!]/g;
const SESSION_MS = 20 * 60_000;

const sentencesOf = (text: string): string[] => text.match(SENTENCE) ?? [];

const appointmentOf = (firstName: string, startsAt: string) => ({
  firstName,
  startsAt: new Date(startsAt),
  endsAt: new Date(new Date(startsAt).getTime() + SESSION_MS),
});

describe("therapist agenda speech", () => {
  describe("nextAppointmentSpeechOf", () => {
    it("ALX-01 RF-11: says the first name and the spoken time of the next appointment", () => {
      expect(nextAppointmentSpeechOf(appointmentOf("Ana", "2026-11-03T17:00:00Z"))).toBe("Próximo: Ana, às 14h.");
    });

    it("RF-11: says there is nothing left today when there is no next appointment", () => {
      expect(nextAppointmentSpeechOf(null)).toBe("Você não tem mais atendimentos hoje.");
    });
  });

  describe("todaySummarySpeechOf", () => {
    const summary = { current: null, next: null, remainingCount: 0, isEmpty: false };

    it("ALX-02 RF-10: says the count first and offers to read every appointment when there is more than one", () => {
      const text = todaySummarySpeechOf({
        ...summary,
        next: appointmentOf("Ana", "2026-11-03T12:00:00Z"),
        remainingCount: 5,
      });

      expect(text).toBe("Hoje, 5 atendimentos. Quer que eu fale todos?");
    });

    it("ALX-02 RF-10: names the only appointment still to come without offering the list", () => {
      const text = todaySummarySpeechOf({
        ...summary,
        next: appointmentOf("Ana", "2026-11-03T12:00:00Z"),
        remainingCount: 1,
      });

      expect(text).toBe("Hoje, 1 atendimento. Primeiro: Ana, às 9h.");
    });

    it("RF-10: says the session in progress when nothing else is still to come", () => {
      const text = todaySummarySpeechOf({
        ...summary,
        current: appointmentOf("Bia", "2026-11-03T17:00:00Z"),
        remainingCount: 1,
      });

      expect(text).toBe("Hoje, 1 atendimento. Agora: Bia, até 14h20.");
    });

    it("RF-10: says there is nothing left today once every appointment is over", () => {
      expect(todaySummarySpeechOf(summary)).toBe("Você não tem mais atendimentos hoje.");
    });

    it("RF-10: says the day is empty when there was no appointment today", () => {
      expect(todaySummarySpeechOf({ ...summary, isEmpty: true })).toBe("Você não tem atendimentos hoje.");
    });
  });

  describe("fullAgendaSpeechOf", () => {
    it("ALX-02 RF-10: reads every appointment with its time, in order, in one sentence", () => {
      const text = fullAgendaSpeechOf([
        appointmentOf("Ana", "2026-11-03T17:00:00Z"),
        appointmentOf("Bruno", "2026-11-03T18:00:00Z"),
        appointmentOf("Carla", "2026-11-03T19:30:00Z"),
      ]);

      expect(text).toBe("Ana às 14h, Bruno às 15h e Carla às 16h30.");
    });

    it("RF-10: says there is nothing left today when the list emptied meanwhile", () => {
      expect(fullAgendaSpeechOf([])).toBe("Você não tem mais atendimentos hoje.");
    });
  });

  describe("RNF-04: every query sentence", () => {
    const ana = appointmentOf("Ana", "2026-11-03T12:05:00Z");
    const texts = [
      nextAppointmentSpeechOf(ana),
      nextAppointmentSpeechOf(null),
      todaySummarySpeechOf({ current: ana, next: ana, remainingCount: 12, isEmpty: false }),
      todaySummarySpeechOf({ current: ana, next: null, remainingCount: 1, isEmpty: false }),
      todaySummarySpeechOf({ current: null, next: null, remainingCount: 0, isEmpty: true }),
      arrivalsSpeechOf({ firstName: "Ana", checkedInAt: new Date("2026-11-03T16:55:00Z") }, 3),
      arrivalsSpeechOf(null, 0),
      fullAgendaSpeechOf([ana, appointmentOf("Bruno", "2026-11-03T13:00:00Z")]),
    ];

    it.each(texts)("has at most two sentences: %s", (text) => {
      expect(sentencesOf(text).length).toBeLessThanOrEqual(2);
    });

    it.each(texts)("has no ID, ISO date, UTC or surname: %s", (text) => {
      expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}|T\d{2}:|UTC|Z\b|[0-9a-f]{8}-/);
      expect(text).not.toMatch(/Souza/);
    });
  });
});
