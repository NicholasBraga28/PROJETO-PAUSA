import { clockReadingsOf, spokenPeriodOf } from "./spoken-time";

const WORKING_HOURS = { startMinutes: 9 * 60, endMinutes: 18 * 60 };

describe("clockReadingsOf", () => {
  it('RF-12: reads "14h" and "duas da tarde" (14:00) only as 14h', () => {
    expect(clockReadingsOf("14:00")).toEqual([{ hour: 14, minute: 0 }]);
  });

  it('RF-12: reads "duas" (02:00) both as 2h and as 14h', () => {
    expect(clockReadingsOf("02:00")).toEqual([
      { hour: 2, minute: 0 },
      { hour: 14, minute: 0 },
    ]);
  });

  it("RF-12: keeps the minutes in both readings", () => {
    expect(clockReadingsOf("03:30")).toEqual([
      { hour: 3, minute: 30 },
      { hour: 15, minute: 30 },
    ]);
  });

  it.each([
    ["00:00", { hour: 0, minute: 0 }],
    ["12:30", { hour: 12, minute: 30 }],
  ])("RF-12: reads midnight and noon (%s) only one way", (slotValue, reading) => {
    expect(clockReadingsOf(slotValue)).toEqual([reading]);
  });

  it.each([undefined, "", "MO", "AF", "EV", "NI", "?", "25:00", "14:75", "14h"])(
    "RF-12: refuses a vague or unreadable time (%p)",
    (slotValue) => {
      expect(clockReadingsOf(slotValue)).toEqual([]);
    },
  );
});

describe("spokenPeriodOf", () => {
  it('RF-13: reads "das três às quatro da tarde" as 15h to 16h', () => {
    expect(spokenPeriodOf("03:00", "16:00", WORKING_HOURS)).toEqual({
      kind: "FOUND",
      startsAt: { hour: 15, minute: 0 },
      endsAt: { hour: 16, minute: 0 },
    });
  });

  it("RF-13: keeps the only reading that fits the working hours", () => {
    expect(spokenPeriodOf("10:00", "11:30", WORKING_HOURS)).toEqual({
      kind: "FOUND",
      startsAt: { hour: 10, minute: 0 },
      endsAt: { hour: 11, minute: 30 },
    });
  });

  it("RF-13: refuses an end before the start", () => {
    expect(spokenPeriodOf("16:00", "15:00", WORKING_HOURS)).toEqual({ kind: "REFUSED" });
  });

  it("RN-08: refuses a period outside the working hours", () => {
    expect(spokenPeriodOf("19:00", "20:00", WORKING_HOURS)).toEqual({ kind: "REFUSED" });
  });

  it.each([
    ["AF", "16:00"],
    ["15:00", "EV"],
    [undefined, "16:00"],
  ])("RF-13: asks for exact times when a time is vague (%p to %p)", (start, end) => {
    expect(spokenPeriodOf(start, end, WORKING_HOURS)).toEqual({ kind: "VAGUE" });
  });

  it("RF-13: does not guess when two readings fit the working hours", () => {
    expect(spokenPeriodOf("09:00", "10:00", { startMinutes: 8 * 60, endMinutes: 22 * 60 })).toEqual({
      kind: "VAGUE",
    });
  });
});
