import { afterEach, vi } from "vitest";
import { cleanup, configure } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

configure({ asyncUtilTimeout: 5000 });

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
vi.stubGlobal("IntersectionObserver", NoopObserver);
vi.stubGlobal("ResizeObserver", NoopObserver);
vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
}));
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
