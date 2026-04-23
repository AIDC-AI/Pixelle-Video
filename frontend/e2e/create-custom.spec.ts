import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const NEW_PROJECT_LABEL = /New Project|新建项目/;
const CUSTOM_ASSET_LABEL = /Custom Asset|自定义资产/;
const ADD_SCENE_LABEL = /Add Scene|添加场景/;
const SCENE_NARRATION_LABEL = /Scene Narration|场景旁白/;
const DURATION_SECONDS_LABEL = /Duration \(seconds\)|时长（秒）/;
const GENERATE_VIDEO_LABEL = /Generate Video|生成视频/;
const RESULT_LABEL = /Result|生成结果/;
const TASK_PROGRESS_LABEL = /Task Progress|任务进度/;
const TASK_STATUS_LABEL = /Queued|Pending|Running|排队中|运行中|生成中/;
const REGENERATE_LABEL = /Regenerate From This|基于此重生成/;

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
  await page.getByText(NEW_PROJECT_LABEL).click();
  await page.getByTestId("create-project-name-input").fill(projectName);
  await page.getByTestId("create-project-submit").click();
  await expect(trigger).toContainText(projectName);
}

async function openPipelineFromCreate(page: Page, label: string | RegExp): Promise<void> {
  await page.goto("/create");
  await page.locator("main").getByRole("link", { name: label }).first().click();
}

async function waitForTaskProgress(page: Page): Promise<void> {
  await expect(page.getByText(TASK_PROGRESS_LABEL)).toBeVisible({ timeout: 15_000 });
  await expect(
    page
      .locator("[data-slot='badge']")
      .filter({ hasText: TASK_STATUS_LABEL })
      .first()
  ).toBeVisible({ timeout: 15_000 });
}

async function waitForVideoResult(page: Page): Promise<void> {
  await expect(page.getByText(RESULT_LABEL)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: REGENERATE_LABEL })).toBeVisible({ timeout: 20_000 });
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

test("custom asset pipeline handles two scenes and completes", async ({ page }) => {
  await mockCompletedTask(page, "**/api/video/custom/async", "e2e-custom-task");
  await openPipelineFromCreate(page, CUSTOM_ASSET_LABEL);
  await createProject(page, uniqueName("custom-asset-project"));

  await page.getByLabel(/Scene 1 media|场景 1 媒体/).setInputFiles(fixturePath("scene.png"));
  await page.getByLabel(SCENE_NARRATION_LABEL).nth(0).fill("Scene one introduces the product with a static key visual.");
  await page.getByRole("button", { name: ADD_SCENE_LABEL }).click();

  await page.getByLabel(/Scene 2 media|场景 2 媒体/).setInputFiles(fixturePath("driver.mp4"));
  await page.getByLabel(SCENE_NARRATION_LABEL).nth(1).fill("Scene two shows motion footage and the closing call to action.");
  await page.getByLabel(DURATION_SECONDS_LABEL).nth(1).fill("6");

  await page.getByRole("button", { name: GENERATE_VIDEO_LABEL }).click();

  await waitForTaskProgress(page);
  await waitForVideoResult(page);
  await expect(page.getByRole("heading", { name: CUSTOM_ASSET_LABEL })).toBeVisible();
});
