import { describe, expect, it } from "vitest";

import {
  readLanguagePreference,
  readSidebarCollapsedPreference,
  writeLanguagePreference,
  writeSidebarCollapsedPreference,
} from "./preferences";

describe("preferences", () => {
  it("defaults language preference to zh-CN when nothing is stored", () => {
    localStorage.removeItem("skyframe-language-preference");

    expect(readLanguagePreference()).toBe("zh-CN");
  });

  it("keeps language writes as a zh-CN compatibility no-op", () => {
    localStorage.setItem("skyframe-language-preference", "legacy");
    writeLanguagePreference("zh-CN");
    expect(readLanguagePreference()).toBe("zh-CN");
    expect(localStorage.getItem("skyframe-language-preference")).toBe("legacy");
  });

  it("reads and writes sidebar collapse preference", () => {
    writeSidebarCollapsedPreference(true);
    expect(readSidebarCollapsedPreference()).toBe(true);

    writeSidebarCollapsedPreference(false);
    expect(readSidebarCollapsedPreference()).toBe(false);
  });
});
