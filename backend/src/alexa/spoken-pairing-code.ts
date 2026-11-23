import { PAIRING_CODE_DIGITS } from "./pairing-code-source";

const DIGITS_OF_A_PAIRING_CODE = new RegExp(`^\\d{1,${PAIRING_CODE_DIGITS}}$`);

export function pairingCodeOf(slotValue: string | undefined): string | undefined {
  if (!slotValue || !DIGITS_OF_A_PAIRING_CODE.test(slotValue)) return undefined;
  return slotValue.padStart(PAIRING_CODE_DIGITS, "0");
}
