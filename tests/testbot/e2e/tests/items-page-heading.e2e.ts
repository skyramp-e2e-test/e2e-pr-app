// The Items page (/items) shows its single main heading as "All items", no longer "Items".
import { test, expect } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { ItemsPage, LoginPage, uiCredentials } from "../pages/items-app";

test("items page shows a single main heading reading All items", async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(15000);
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = uiCredentials();
  const login = new LoginPage(page);
  const items = new ItemsPage(page);

  await test.step("sign in at /login and land on /items", async () => {
    await login.goto();
    await login.signInAs(username, password);
    await expect(page).toHaveURL(/\/items$/);
  });

  await test.step("the page has one level-1 heading, reading exactly All items", async () => {
    await expect.soft(items.mainHeadings).toHaveCount(1);
    await expect.soft(items.mainHeadings).toHaveText("All items");
    await expect.soft(items.heading("All items")).toBeVisible();
  });

  await test.step("no heading reads Items any more", async () => {
    await expect.soft(items.heading("Items")).toHaveCount(0);
  });
});
