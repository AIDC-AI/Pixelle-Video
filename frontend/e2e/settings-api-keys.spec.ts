import { expect, test } from "@playwright/test";

test("api key validation renders inline results and stale state", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("skyframe-language-preference", "zh-CN");
  });

  await page.route("**/api/settings/llm/check", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: "llm",
        status: "success",
        success: true,
        reachable: true,
        authenticated: true,
        message: "LLM credentials verified.",
        endpoint: "https://api.openai.com/v1",
        status_code: 200,
        response_time_ms: 93,
        diagnostics: {
          error_code: null,
          model_count: 3,
          selected_model: "gpt-5.4",
          selected_model_available: true,
          auth_applied: null,
          auth_required: null,
          api_type: null,
          current_task_nums: null,
          remain_num: null,
          remain_money: null,
          currency: null,
        },
      }),
    });
  });

  await page.route("**/api/settings/runninghub/check", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: "runninghub",
        status: "error",
        success: false,
        reachable: true,
        authenticated: false,
        message: "RunningHub rejected the supplied API key.",
        endpoint: "https://www.runninghub.cn/uc/openapi/accountStatus",
        status_code: 200,
        response_time_ms: 111,
        diagnostics: {
          error_code: "RUNNINGHUB_401",
          model_count: null,
          selected_model: null,
          selected_model_available: null,
          auth_applied: null,
          auth_required: null,
          api_type: null,
          current_task_nums: null,
          remain_num: null,
          remain_money: null,
          currency: null,
        },
      }),
    });
  });

  await page.goto("/settings");

  await page.getByTestId("settings-llm-verify").click();
  await expect(page.getByTestId("settings-llm-status")).toHaveText("Verified");
  await expect(page.getByTestId("settings-llm-result")).toContainText("LLM credentials verified.");

  await page.getByTestId("settings-runninghub-verify").click();
  await expect(page.getByTestId("settings-runninghub-status")).toHaveText("Validation Failed");
  await expect(page.getByTestId("settings-runninghub-result")).toContainText(
    "RunningHub rejected the supplied API key."
  );

  await page.getByTestId("settings-llm-base-url").fill("https://api.example.com/v2");
  await expect(page.getByTestId("settings-llm-status")).toHaveText("Needs Revalidation");
  await expect(page.getByTestId("settings-runninghub-status")).toHaveText("Validation Failed");
});
