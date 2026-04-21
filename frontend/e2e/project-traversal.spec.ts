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

async function readCurrentProjectFromStorage(page: Page): Promise<{ id: string; name: string } | null> {
  return page.evaluate(() => {
    const rawValue = window.localStorage.getItem("current-project-storage");
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as {
      state?: {
        currentProject?: { id: string; name: string } | null;
      };
    };

    return parsed.state?.currentProject ?? null;
  });
}

async function selectFirstOption(page: Page, triggerLabel: string): Promise<void> {
  await page.getByLabel(triggerLabel).click();
  await page.locator("[data-slot='select-content']:visible [data-slot='select-item']").first().click();
}

async function waitForVideoResult(page: Page): Promise<void> {
  await expect(page.getByText("生成结果")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: "基于此重生成" })).toBeVisible({ timeout: 20_000 });
}

test("project selection flows from create to library detail and regenerate", async ({ page }) => {
  const projectName = uniqueName("project");
  const title = uniqueName("Traversal Video");
  const topic = "Show how the redesigned workbench moves from idea to reusable asset library.";

  await page.goto("/create");
  await createProject(page, projectName);
  await page.locator("main").getByRole("link", { name: /Quick/ }).first().click();

  await page.getByLabel("视频标题").fill(title);
  await page.getByLabel("创意描述 (Topic)").fill(topic);
  await selectFirstOption(page, "配音 (TTS)");
  await selectFirstOption(page, "媒体流 (Media)");
  await page.getByRole("button", { name: "生成视频" }).click();
  await waitForVideoResult(page);

  const currentProject = await readCurrentProjectFromStorage(page);
  expect(currentProject?.name).toBe(projectName);

  await page.goto("/library/videos");
  await expect(page.getByText(title)).toBeVisible({ timeout: 20_000 });
  await page.getByText(title).click();

  await expect(page).toHaveURL(/\/library\/videos\/.+/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("button", { name: "Regenerate From This" }).click();

  await expect(page).toHaveURL(/\/create\/quick/);
  await expect(page.getByLabel("视频标题")).toHaveValue(title);
  await expect(page.getByLabel("创意描述 (Topic)")).toHaveValue(topic);
});
