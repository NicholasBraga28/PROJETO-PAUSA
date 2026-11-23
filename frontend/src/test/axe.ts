import { expect } from "vitest";
import axe from "axe-core";

const JSDOM_HAS_NO_COMPUTED_COLORS = { "color-contrast": { enabled: false } };

export async function expectAccessible(node: Element = document.body) {
  const { violations } = await axe.run(node, { rules: JSDOM_HAS_NO_COMPUTED_COLORS });
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}
