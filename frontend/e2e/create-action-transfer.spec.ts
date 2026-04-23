import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

function fixturePath(fileName: string): string {
  return path.resolve(process.cwd(), "e2e", "fixtures", fileName);
}

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

async function selectFirstOption(page: Page, triggerLabel: string | RegExp): Promise<void> {
  await page.getByLabel(triggerLabel).click();
  await page.locator("[data-slot='select-content']:visible [data-slot='select-item']").first().click();
}

async function waitForTaskProgress(page: Page): Promise<void> {
  await expect(page.getByText(/Task Progress|任务进度/)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-slot='badge']").filter({ hasText: /Queued|Running|排队中|生成中/ }).first()).toBeVisible({
    timeout: 15_000,
  });
}

async function waitForVideoResult(page: Page): Promise<void> {
  await expect(page.getByText(/Result|生成结果/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Regenerate From This|基于此重生成/ })).toBeVisible({ timeout: 20_000 });
}

test("action transfer pipeline uploads driver and target media, then completes", async ({ page }) => {
  await openPipelineFromCreate(page, "Action Transfer");
  await createProject(page, uniqueName("action-transfer-project"));

  await page.getByLabel("Driver video").setInputFiles(fixturePath("driver.mp4"));
  await page.getByLabel("Target image").setInputFiles(fixturePath("target.png"));
  await selectFirstOption(page, "Pose workflow");

  await page.getByRole("button", { name: "Generate Video" }).click();

  await waitForTaskProgress(page);
  await waitForVideoResult(page);
  await expect(page.getByRole("heading", { name: "Action Transfer" })).toBeVisible();
});
