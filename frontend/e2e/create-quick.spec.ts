import { expect, test, type Page } from "@playwright/test";

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

async function createProject(page: Page, projectName: string): Promise<void> {
  const trigger = page.getByTestId("project-switcher-trigger");
  await expect(trigger).toBeVisible();
  await trigger.click();
  await page.getByText("New Project").click();
  await page.getByTestId("create-project-name-input").fill(projectName);
  await page.getByTestId("create-project-submit").click();
  await expect(trigger).toContainText(projectName);
}

async function openPipelineFromCreate(page: Page, label: string): Promise<void> {
  await page.goto("/create");
  await page.locator("main").getByRole("link", { name: new RegExp(label) }).first().click();
}

async function selectFirstOption(page: Page, triggerLabel: string): Promise<void> {
  await page.getByLabel(triggerLabel).click();
  const firstItem = page.locator("[data-slot='select-content']:visible [data-slot='select-item']").first();
  await firstItem.click();
}

async function waitForTaskProgress(page: Page): Promise<void> {
  await expect(page.getByText("任务进度")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-slot='badge']").filter({ hasText: /排队中|生成中/ }).first()).toBeVisible({
    timeout: 15_000,
  });
}

async function waitForVideoResult(page: Page): Promise<void> {
  await expect(page.getByText("生成结果")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "基于此重生成" })).toBeVisible({ timeout: 20_000 });
}

test("quick pipeline submits, polls, and renders a video result", async ({ page }) => {
  const projectName = uniqueName("quick-project");
  const title = uniqueName("Quick Video");
  const topic = "Explain how a pixel-art planet gains its rings over time.";

  await openPipelineFromCreate(page, "Quick");
  await createProject(page, projectName);

  await page.getByLabel("视频标题").fill(title);
  await page.getByLabel("创意描述 (Topic)").fill(topic);
  await selectFirstOption(page, "配音 (TTS)");
  await selectFirstOption(page, "媒体流 (Media)");

  await page.getByRole("button", { name: "生成视频" }).click();

  await waitForTaskProgress(page);
  await waitForVideoResult(page);
  await expect(page.getByRole("button", { name: "基于此重生成" })).toBeVisible();
});
