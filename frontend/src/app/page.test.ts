import { describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect }));

describe("RootPage", () => {
  it("redirects to /create", async () => {
    const { default: RootPage } = await import("./page");
    try {
      RootPage();
    } catch {
      // next's redirect throws in runtime; mock does not, but guard either way
    }
    expect(redirect).toHaveBeenCalledWith("/create");
  });
});
