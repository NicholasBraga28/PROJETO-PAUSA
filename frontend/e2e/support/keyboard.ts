import type { Page } from "@playwright/test";

const MAX_TABS = 150;
const MIN_OUTLINE_PX = 2;
const INDICATOR_ANCESTOR_DEPTH = 3;
const NAME_PREVIEW_LENGTH = 60;

declare global {
  interface Window {
    tabWalkStylesBeforeTab?: WeakMap<Element, string>;
    tabWalkPreviousFocus?: Element | null;
    tabWalkLastReportedFocus?: Element | null;
  }
}

export interface TabStop {
  name: string;
  isFocusVisible: boolean;
  isInDomOrder: boolean;
}

export interface TabWalk {
  stops: TabStop[];
  unreached: string[];
}

export async function walkWithTab(page: Page): Promise<TabWalk> {
  await page.evaluate(() => {
    const start = document.createElement("span");
    start.id = "tab-walk-start";
    start.tabIndex = -1;
    document.body.prepend(start);
    start.focus();
  });

  const stops: TabStop[] = [];
  for (let tab = 0; tab < MAX_TABS; tab++) {
    await page.evaluate(() => {
      const styles = new WeakMap<Element, string>();
      for (const element of document.querySelectorAll("*")) {
        const style = getComputedStyle(element);
        styles.set(element, `${style.outlineStyle} ${style.outlineWidth} ${style.boxShadow}`);
      }
      window.tabWalkStylesBeforeTab = styles;
      window.tabWalkPreviousFocus = document.activeElement;
    });
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(
      ({ minOutline, ancestorDepth, nameLength }) => {
        const focused = document.activeElement;
        if (!focused || focused === document.body || focused.id === "tab-walk-start") return null;
        const before = window.tabWalkStylesBeforeTab;
        const previous = window.tabWalkPreviousFocus;
        focused.setAttribute("data-tab-reached", "");

        if (focused === window.tabWalkLastReportedFocus) return { skip: true as const };

        const box = focused.closest("label") ?? focused;
        const candidates = new Set<Element>([focused, ...box.querySelectorAll("*")]);
        for (
          let node = focused.parentElement, depth = 0;
          node && depth < ancestorDepth;
          node = node.parentElement, depth++
        )
          candidates.add(node);
        const isFocusVisible = [...candidates].some((candidate) => {
          const style = getComputedStyle(candidate);
          const hasOutline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= minOutline;
          const hasIndicator = hasOutline || style.boxShadow !== "none";
          return (
            hasIndicator && before?.get(candidate) !== `${style.outlineStyle} ${style.outlineWidth} ${style.boxShadow}`
          );
        });

        const isInDomOrder =
          !previous ||
          previous.id === "tab-walk-start" ||
          Boolean(previous.compareDocumentPosition(focused) & Node.DOCUMENT_POSITION_FOLLOWING);
        const name = focused.getAttribute("aria-label") ?? (focused.textContent ?? "").trim().slice(0, nameLength);
        window.tabWalkLastReportedFocus = focused;
        return {
          name: `${focused.tagName.toLowerCase()} "${name}"`,
          isFocusVisible,
          isInDomOrder,
          skip: false as const,
        };
      },
      { minOutline: MIN_OUTLINE_PX, ancestorDepth: INDICATOR_ANCESTOR_DEPTH, nameLength: NAME_PREVIEW_LENGTH },
    );
    if (!stop) break;
    if (stop.skip) continue;
    stops.push({ name: stop.name, isFocusVisible: stop.isFocusVisible, isInDomOrder: stop.isInDomOrder });
  }

  const unreached = await page.evaluate((nameLength) => {
    const controls = [
      ...document.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((control) => control.checkVisibility() && !control.closest("[inert]"));
    const isRadioImplementationInput = (control: HTMLElement) =>
      control instanceof HTMLInputElement && control.type === "radio" && Boolean(control.closest('[role="radiogroup"]'));
    return controls
      .filter((control) => !control.hasAttribute("data-tab-reached"))
      .filter((control) => !isRadioImplementationInput(control))
      .map(
        (control) =>
          `${control.tagName.toLowerCase()} "${control.getAttribute("aria-label") ?? (control.textContent ?? "").trim().slice(0, nameLength)}"`,
      );
  }, NAME_PREVIEW_LENGTH);

  return { stops, unreached };
}
