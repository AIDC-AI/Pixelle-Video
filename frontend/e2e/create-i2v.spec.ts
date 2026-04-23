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
  await page.getByText(/New Project|新建项目/).click();
  await page.getByTestId("create-project-name-input").fill(projectName);
  await page.getByTestId("create-project-submit").click();
  await expect(trigger).toContainText(projectName);
}

async function selectFirstOption(page: Page, triggerLabel: string | RegExp): Promise<void> {
  await page.getByLabel(triggerLabel).click();
  await page.locator("[data-slot='select-content']:visible [data-slot='select-item']").first().click();
}

async function selectOptionByText(page: Page, triggerLabel: string | RegExp, optionText: RegExp): Promise<void> {
  await page.getByLabel(triggerLabel).click();
  await page.locator("[data-slot='select-content']:visible [data-slot='select-item']").filter({ hasText: optionText }).first().click();
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

async function mockCompletedTask(page: Page, submitPattern: string, taskId: string): Promise<void> {
  let pollCount = 0;

  await page.route(submitPattern, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        message: "Task created successfully",
        task_id: taskId,
      }),
    });
  });

  await page.route(`**/api/tasks/${taskId}`, async (route) => {
    pollCount += 1;
    const completed = pollCount >= 2;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        task_id: taskId,
        task_type: "video_generation",
        project_id: null,
        batch_id: null,
        status: completed ? "completed" : "running",
        progress: completed
          ? { current: 1, total: 1, percentage: 100, message: "Done" }
          : { current: 0, total: 1, percentage: 30, message: "Rendering" },
        result: completed
          ? {
              video_url: "https://example.com/mock.mp4",
              duration: 3,
              file_size: 1024,
            }
          : null,
        error: null,
        created_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: completed ? new Date().toISOString() : null,
        request_params: {},
      }),
    });
  });
}

test("image to video pipeline uploads an image and completes", async ({ page }) => {
  await mockCompletedTask(page, "**/api/video/i2v/async", "e2e-i2v-task");
  await page.goto("/create/i2v");
  await createProject(page, uniqueName("i2v-project"));

  await page.getByLabel(/Source image|源图片/).setInputFiles(fixturePath("source.png"));
  await page.getByLabel(/Motion Prompt|运动提示词/).fill("Add a gentle camera push-in with floating nebula particles.");
  await selectOptionByText(page, /Media workflow|媒体工作流/, /Runninghub/i);
  await expect(page.getByTestId("i2v-runninghub-instance-type")).toBeVisible();

  await page.getByRole("button", { name: /Generate Video|生成视频/ }).click();

  await waitForTaskProgress(page);
  await waitForVideoResult(page);
  await expect(page.getByRole("heading", { name: /Image → Video|图片转视频/ })).toBeVisible();
});
