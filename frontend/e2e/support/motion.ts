import type { Page } from "@playwright/test";

const SCROLL_STEPS = 24;
const FRAMES_PER_STEP = 6;
const SETTLE_FRAMES = 40;
const MIN_SCROLL_STEPS_TO_FOLLOW = 4;
const DESCRIBED_CLASS_COUNT = 3;
const DESCRIBED_TEXT_LENGTH = 40;

export function movingElements(page: Page): Promise<string[]> {
  return page.evaluate(
    async ({ steps, framesPerStep, settleFrames, minScrollSteps, classCount, textLength }) => {
      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const isPinned = (element: Element) => {
        for (let node: Element | null = element; node; node = node.parentElement) {
          const { position } = getComputedStyle(node);
          if (position === "fixed" || position === "sticky") return true;
        }
        return false;
      };
      const elements = [...document.body.querySelectorAll("*")].filter(
        (element) => !isPinned(element) && element.getClientRects().length > 0,
      );
      const tracks = new Map(
        elements.map((element) => [
          element,
          { position: "", hasChangedLastFrame: false, scrollSteps: new Set<number>(), isAnimated: false },
        ]),
      );
      const sample = (step: number, frame: number) => {
        for (const [element, track] of tracks) {
          const rect = element.getBoundingClientRect();
          const position = `${Math.round(rect.left + scrollX)},${Math.round(rect.top + scrollY)}`;
          const hasChanged = track.position !== "" && position !== track.position;
          if (hasChanged && frame === 0) track.scrollSteps.add(step);
          if (hasChanged && frame > 0 && track.hasChangedLastFrame) track.isAnimated = true;
          track.hasChangedLastFrame = hasChanged && frame > 0;
          track.position = position;
        }
      };

      const maxScroll = document.documentElement.scrollHeight - innerHeight;
      for (let step = 0; step <= steps; step++) {
        window.scrollTo({ top: (maxScroll * step) / steps, behavior: "instant" });
        for (let frame = 0; frame < framesPerStep; frame++) {
          await nextFrame();
          sample(step, frame);
        }
      }
      for (let frame = 1; frame <= settleFrames; frame++) {
        await nextFrame();
        sample(steps + 1, frame);
      }
      window.scrollTo({ top: 0, behavior: "instant" });

      const moved = new Set(
        [...tracks]
          .filter(([, track]) => track.isAnimated || track.scrollSteps.size >= minScrollSteps)
          .map(([element]) => element),
      );
      const describe = (element: Element) => {
        const id = element.id ? `#${element.id}` : "";
        const classes = [...element.classList]
          .slice(0, classCount)
          .map((name) => `.${name}`)
          .join("");
        return `${element.tagName.toLowerCase()}${id}${classes} "${(element.textContent ?? "").trim().slice(0, textLength)}"`;
      };
      return [...moved].filter((element) => !element.parentElement || !moved.has(element.parentElement)).map(describe);
    },
    {
      steps: SCROLL_STEPS,
      framesPerStep: FRAMES_PER_STEP,
      settleFrames: SETTLE_FRAMES,
      minScrollSteps: MIN_SCROLL_STEPS_TO_FOLLOW,
      classCount: DESCRIBED_CLASS_COUNT,
      textLength: DESCRIBED_TEXT_LENGTH,
    },
  );
}
