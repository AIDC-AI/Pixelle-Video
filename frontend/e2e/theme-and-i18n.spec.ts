import { expect, test } from "@playwright/test";

test("theme toggle persists after reload", async ({ page }) => {
  await page.goto("/create");

  const html = page.locator("html");
  await expect(html).toHaveClass(/dark/);

  await page.getByRole("button", { name: /Toggle theme|切换主题/ }).click();
  await expect(html).not.toHaveClass(/dark/);

  await page.reload();
  await expect(html).not.toHaveClass(/dark/);
});

test("app stays in Chinese after reloads", async ({ page }) => {
  await page.goto("/settings?tab=appearance");
  await page.evaluate(() => {
    window.localStorage.removeItem("skyframe-language-preference");
  });
  await page.reload();

  await page.goto("/create");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByText("最快速的视频生成方式。输入创意描述，系统自动编写脚本、配音并生成分镜视频。")).toBeVisible();

  await page.goto("/settings?tab=appearance");
  await expect(page.getByRole("combobox", { name: /Language|语言/ })).toHaveCount(0);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
});

test("zh-first locale reaches translated batch, library, and workflows routes", async ({ page }) => {
  await page.goto("/create");
  await page.evaluate(() => {
    window.localStorage.setItem("skyframe-language-preference", "zh-CN");
  });

  await page.goto("/batch/queue");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("heading", { name: "任务队列" })).toBeVisible();

  await page.goto("/library/videos");
  await expect(page.getByRole("heading", { name: "视频" })).toBeVisible();

  await page.goto("/workflows");
  await expect(
    page.getByText("按用途查看所有可用生成方案。首屏优先展示中文名称、适用场景和来源，技术文件名会下沉到详情页。")
  ).toBeVisible();
});
