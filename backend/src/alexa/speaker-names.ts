import { firstNameOf } from "../common/names/first-name";
import type { SpeakerCandidate } from "./alexa-speaker-resolver";

const WHITESPACE = /\s+/;
const DIACRITICS = /\p{Diacritic}/gu;

export type SpeakerEntity = Readonly<{ therapistId: string; spokenName: string }>;
export type SpokenName = Readonly<{ value?: string; resolvedId?: string }>;

const comparableOf = (name: string): string =>
  name.normalize("NFD").replace(DIACRITICS, "").toLowerCase().trim().split(WHITESPACE).join(" ");

const firstAndLastNameOf = (name: string): string => {
  const words = name.trim().split(WHITESPACE);
  return words.length === 1 ? words[0] : `${words[0]} ${words[words.length - 1]}`;
};

const sharedFirstNamesOf = (candidates: readonly SpeakerCandidate[]): Set<string> => {
  const firstNames = candidates.map(({ name }) => comparableOf(firstNameOf(name)));
  return new Set(firstNames.filter((firstName, index) => firstNames.indexOf(firstName) !== index));
};

export function hasSharedFirstNames(candidates: readonly SpeakerCandidate[]): boolean {
  return sharedFirstNamesOf(candidates).size > 0;
}

export function speakerEntitiesOf(candidates: readonly SpeakerCandidate[]): SpeakerEntity[] {
  const shared = sharedFirstNamesOf(candidates);
  return candidates.map(({ therapistId, name }) => {
    const firstName = firstNameOf(name);
    const isShared = shared.has(comparableOf(firstName));
    return { therapistId, spokenName: isShared ? firstAndLastNameOf(name) : firstName };
  });
}

export function candidatesNamed(candidates: readonly SpeakerCandidate[], spoken: SpokenName): SpeakerCandidate[] {
  const byId = candidates.filter(({ therapistId }) => therapistId === spoken.resolvedId);
  if (byId.length > 0) return byId;
  if (!spoken.value) return [];
  const heard = comparableOf(spoken.value);
  const entities = speakerEntitiesOf(candidates);
  return candidates.filter(
    ({ name }, index) => heard === comparableOf(entities[index].spokenName) || heard === comparableOf(name),
  );
}
