import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

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

afterEach(() => {
  cleanup();
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
});
