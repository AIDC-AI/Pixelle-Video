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

async function selectFirstOption(page: Page, triggerLabel: string): Promise<void> {
  await page.getByLabel(triggerLabel).click();
  await page.locator("[data-slot='select-content']:visible [data-slot='select-item']").first().click();
}

async function waitForVideoResult(page: Page): Promise<void> {
  await expect(page.getByText("生成结果")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "基于此重生成" })).toBeVisible({ timeout: 20_000 });
}

async function submitQuick(page: Page, title: string, topic: string): Promise<string> {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/video/generate/async") &&
      response.request().method() === "POST"
  );

  await page.getByLabel("视频标题").fill(title);
  await page.getByLabel("创意描述 (Topic)").fill(topic);
  await selectFirstOption(page, "配音 (TTS)");
  await selectFirstOption(page, "媒体流 (Media)");
  await page.getByRole("button", { name: "生成视频" }).click();

  const response = await responsePromise;
  const payload = (await response.json()) as { task_id: string };
  return payload.task_id;
}

test("library pagination/filtering and queue cancellation work with the live backend", async ({ page }) => {
  const projectName = uniqueName("library-project");
  const firstTitle = uniqueName("Library One");
  const secondTitle = uniqueName("Library Two");
  const runningTitle = uniqueName("Queue Cancel");

  await page.goto("/create/quick");
  await createProject(page, projectName);

  await submitQuick(page, firstTitle, "Create the first reusable library sample.");
  await waitForVideoResult(page);

  await page.getByRole("button", { name: "基于此重生成" }).click();
  await submitQuick(page, secondTitle, "Create the second reusable library sample.");
  await waitForVideoResult(page);

  await page.goto("/library/videos?limit=1");
  await expect(page.getByText(secondTitle)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Load More" }).click();
  await expect(page.getByText(firstTitle)).toBeVisible({ timeout: 20_000 });

  await page.getByLabel("Project filter").click();
  await page.getByText("Unassigned").click();
  await expect(page.getByText("This project has no generated videos yet.")).toBeVisible();

  await page.goto("/create/quick");
  const runningTaskId = await submitQuick(page, runningTitle, "Create a task that will be cancelled from the queue.");

  await page.goto("/batch/queue");
  await expect(page.getByText(runningTaskId)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page
      .locator("div")
      .filter({ hasText: runningTaskId })
      .filter({ hasText: "Cancelled" })
      .first()
  ).toBeVisible({ timeout: 20_000 });

  await page.getByLabel("Status filter").click();
  await page
    .locator("[data-slot='select-content']:visible [data-slot='select-item']")
    .filter({ hasText: "Cancelled" })
    .first()
    .click();
  await expect(page.getByText(runningTaskId)).toBeVisible({ timeout: 20_000 });
});
