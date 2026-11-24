import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { ItemsPage, LoginPage, requiredEnv } from "../support/items-pages";

test("Items page shows the single h1 Your items and no heading named Items", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const email = requiredEnv("SKYRAMP_UI_USERNAME");
  const password = requiredEnv("SKYRAMP_UI_PASSWORD");
  const login = new LoginPage(page);
  const items = new ItemsPage(page);

  await test.step("sign in through /login", async () => {
    await login.goto();
    await login.signInAs(email, password);
    await expect(page).toHaveURL(/\/items$/);
  });

  await test.step("the h1 reads exactly Your items", async () => {
    await expect(items.mainHeading).toHaveCount(1);
    await expect.soft(items.mainHeading).toHaveText("Your items", { useInnerText: true });
  });

  await test.step("no heading is named exactly Items", async () => {
    await expect.soft(items.bareItemsHeading).toHaveCount(0);
  });

  await test.step("the Items nav link is still there", async () => {
    await expect.soft(items.navItems).toBeVisible();
    await expect.soft(items.navItems).toHaveText("Items");
    await expect.soft(items.navItems).toHaveAttribute("href", "/items");
  });
});
