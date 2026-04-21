import { expect, test } from "@playwright/test";

test("theme toggle persists after reload", async ({ page }) => {
  await page.goto("/create");

  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(html).not.toHaveClass(/dark/);

  await page.reload();
  await expect(html).not.toHaveClass(/dark/);
});

test.skip("i18n locale switching persists across reloads", async () => {
  // TODO(P3): next-intl has not been wired into the App Router yet.
});
