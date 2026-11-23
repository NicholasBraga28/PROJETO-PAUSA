import { describe, it, expect } from "vitest";
import { parseCheckInToken } from "./check-in-token";

describe("parseCheckInToken", () => {
  it.each(["6f1c2a4e-9b3d-4c8a-a2f1-0e5b7d9c3a11", "demo-sao-paulo-sala-1"])(
    "TK-09.04: aceita o token da sala %s",
    (token) => {
      expect(parseCheckInToken(token)).toBe(token);
    },
  );

  it.each(["", "<script>", "sala 1", "../me", "%2e%2e", "a".repeat(129)])(
    "TK-09.04: recusa o token fora do formato %j",
    (token) => {
      expect(parseCheckInToken(token)).toBeNull();
    },
  );
});
