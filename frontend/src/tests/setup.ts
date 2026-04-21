import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { beforeAll, afterAll, afterEach } from "vitest";
import { server } from "./msw/server";

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
  window.HTMLElement.prototype.getAnimations = () => [];
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

afterEach(() => {
  cleanup();
  server.resetHandlers();
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
});
