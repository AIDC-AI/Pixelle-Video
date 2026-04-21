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

test("custom asset pipeline handles two scenes and completes", async ({ page }) => {
  await openPipelineFromCreate(page, "Custom Asset");
  await createProject(page, uniqueName("custom-asset-project"));

  await page.getByLabel("Scene 1 media").setInputFiles(fixturePath("scene.png"));
  await page.getByLabel("Scene Narration").nth(0).fill("Scene one introduces the product with a static key visual.");
  await page.getByRole("button", { name: "Add Scene" }).click();

  await page.getByLabel("Scene 2 media").setInputFiles(fixturePath("driver.mp4"));
  await page.getByLabel("Scene Narration").nth(1).fill("Scene two shows motion footage and the closing call to action.");
  await page.getByLabel("Duration (seconds)").nth(1).fill("6");

  await page.getByRole("button", { name: "Generate Video" }).click();

  await waitForTaskProgress(page);
  await waitForVideoResult(page);
  await expect(page.getByRole("heading", { name: "Custom Asset" })).toBeVisible();
});
