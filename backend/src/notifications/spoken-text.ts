import { messages } from "../messages/catalog";
import { addLocalDays, datePartsAt, isoWeekday } from "../reports/report-date";

export { firstNameOf } from "../common/names/first-name";

const SPOKEN_TIMEZONE = "America/Sao_Paulo";
const SPOKEN_LOCALE = "pt-BR";
const MINUTE_DIGITS = 2;
const SINGULAR_HOURS: readonly number[] = [0, 1];
const SINGULAR_COUNT = 1;
const FIRST_DAY_OF_MONTH = 1;
const DAYS_UNTIL_TOMORROW = 1;
const ONE_BASED_OFFSET = 1;
const WHITESPACE = /\s+/g;
const ENDS_WITH_PUNCTUATION = /[.?!]$/;
const SENTENCE_SEPARATOR = " ";

export type SpokenNoun = Readonly<{ singular: string; plural: string }>;
export type SpokenAppointmentStatus = keyof typeof messages.speech.appointmentStatuses;
export type SpokenSentences = readonly [string] | readonly [string, string];

type LocalDay = "TODAY" | "TOMORROW" | "OTHER";

export function clockTimeOf(instant: Date): string {
  const { hour, minute } = datePartsAt(instant, SPOKEN_TIMEZONE);
  const spokenMinute = minute === 0 ? "" : String(minute).padStart(MINUTE_DIGITS, "0");
  return messages.speech.clockTime(hour, spokenMinute);
}

export function atTimeOf(instant: Date): string {
  return messages.speech.atTime(clockTimeOf(instant), isSingularHour(instant));
}

export function fromTimeOf(instant: Date): string {
  return messages.speech.fromTime(clockTimeOf(instant), isSingularHour(instant));
}

export function intervalOf(start: Date, end: Date): string {
  return messages.speech.interval(fromTimeOf(start), atTimeOf(end));
}

export function dayOf(instant: Date, now: Date): string {
  const localDay = localDayOf(instant, now);
  if (localDay === "TODAY") return "";
  if (localDay === "TOMORROW") return messages.speech.tomorrow;
  return otherDayOf(localDateOf(instant));
}

export function whenOf(instant: Date, now: Date): string {
  const atTime = atTimeOf(instant);
  const localDay = localDayOf(instant, now);
  if (localDay === "TODAY") return atTime;
  if (localDay === "TOMORROW") return messages.speech.tomorrowAt(messages.speech.tomorrow, atTime);
  return messages.speech.otherDayAt(otherDayOf(localDateOf(instant)), atTime);
}

export function calendarDateOf(instant: Date): string {
  const [, month, dayOfMonth] = localDateOf(instant).split("-").map(Number);
  return messages.speech.calendarDate(dayOfMonthOf(dayOfMonth), messages.speech.months[month - ONE_BASED_OFFSET]);
}

export function countOf(count: number, noun: SpokenNoun): string {
  return messages.speech.count(count, count === SINGULAR_COUNT ? noun.singular : noun.plural);
}

export function spokenListOf(items: readonly string[]): string {
  return new Intl.ListFormat(SPOKEN_LOCALE, { type: "conjunction" }).format(items);
}

export function spokenAlternativesOf(items: readonly string[]): string {
  return new Intl.ListFormat(SPOKEN_LOCALE, { type: "disjunction" }).format(items);
}

export function appointmentStatusOf(status: SpokenAppointmentStatus): string {
  return messages.speech.appointmentStatuses[status];
}

export function spokenTextOf(sentences: SpokenSentences): string {
  return sentences.map(sentenceOf).join(SENTENCE_SEPARATOR);
}

function sentenceOf(text: string): string {
  const collapsed = text.replace(WHITESPACE, " ").trim();
  const capitalized = collapsed.charAt(0).toLocaleUpperCase(SPOKEN_LOCALE) + collapsed.slice(1);
  return ENDS_WITH_PUNCTUATION.test(capitalized) ? capitalized : capitalized + messages.speech.sentenceEnd;
}

function localDayOf(instant: Date, now: Date): LocalDay {
  const day = localDateOf(instant);
  const today = localDateOf(now);
  if (day === today) return "TODAY";
  if (day === addLocalDays(today, DAYS_UNTIL_TOMORROW)) return "TOMORROW";
  return "OTHER";
}

function otherDayOf(localDate: string): string {
  const [, month, dayOfMonth] = localDate.split("-").map(Number);
  return messages.speech.otherDay(
    messages.speech.onWeekdays[isoWeekday(localDate) - ONE_BASED_OFFSET],
    dayOfMonthOf(dayOfMonth),
    messages.speech.months[month - ONE_BASED_OFFSET],
  );
}

function dayOfMonthOf(dayOfMonth: number): string {
  return messages.speech.dayOfMonth(dayOfMonth, dayOfMonth === FIRST_DAY_OF_MONTH);
}

function localDateOf(instant: Date): string {
  return datePartsAt(instant, SPOKEN_TIMEZONE).date;
}

function isSingularHour(instant: Date): boolean {
  return SINGULAR_HOURS.includes(datePartsAt(instant, SPOKEN_TIMEZONE).hour);
}
