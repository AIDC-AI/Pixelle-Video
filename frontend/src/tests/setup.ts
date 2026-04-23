import 'fake-indexeddb/auto';
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from 'jest-axe';
import { beforeAll, beforeEach, afterAll, afterEach } from "vitest";
import { resetMockApiState } from "./msw/handlers";
import { server } from "./msw/server";

process.env.NEXT_PUBLIC_TASK_POLL_INTERVAL_MS = '20';

expect.extend(toHaveNoViolations);

const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] || null,
  };
};

globalThis.localStorage = createStorageMock() as Storage;
globalThis.sessionStorage = createStorageMock() as Storage;

// Polyfill for Base UI and Radix UI components in JSDOM
if (typeof window !== 'undefined') {
  class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = ResizeObserver;
  }

  if (!window.PointerEvent) {
    class PointerEventPolyfill extends MouseEvent {
      isPrimary: boolean;
      pointerId: number;
      pointerType: string;

      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 1;
        this.pointerType = params.pointerType ?? 'mouse';
        this.isPrimary = params.isPrimary ?? true;
      }
    }

    Object.defineProperty(window, 'PointerEvent', {
      value: PointerEventPolyfill,
      configurable: true,
      writable: true,
    });
  }

  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query === '(hover: hover)',
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }

  if (!navigator.clipboard) {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => Promise.resolve(),
      },
    });
  }

  window.HTMLElement.prototype.getAnimations = () => [];
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockApiState();
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
});

beforeAll(() => {
  globalThis.localStorage.setItem('skyframe-language-preference', 'zh-CN');
  document.documentElement.lang = 'zh-CN';
});

beforeEach(() => {
  globalThis.localStorage.setItem('skyframe-language-preference', 'zh-CN');
  document.documentElement.lang = 'zh-CN';
});

afterEach(() => {
  globalThis.localStorage.setItem('skyframe-language-preference', 'zh-CN');
  document.documentElement.lang = 'zh-CN';
});
