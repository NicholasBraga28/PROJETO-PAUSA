import { pairingCodeOf } from "./spoken-pairing-code";

describe("pairingCodeOf", () => {
  it("D-18 RF-17: keeps a six-digit code as it is", () => {
    expect(pairingCodeOf("482913")).toBe("482913");
  });

  it("D-18 RF-17: restores the leading zeros the number slot drops (L8)", () => {
    expect(pairingCodeOf("48213")).toBe("048213");
    expect(pairingCodeOf("7")).toBe("000007");
  });

  it("D-18 RF-17: refuses a number with more than six digits", () => {
    expect(pairingCodeOf("1482913")).toBeUndefined();
  });

  it.each([undefined, "", "?", "48 213", "-48213", "4821.3"])(
    "D-18 RF-17: refuses a slot value that is not a number of digits (%p)",
    (slotValue) => {
      expect(pairingCodeOf(slotValue)).toBeUndefined();
    },
  );
});
