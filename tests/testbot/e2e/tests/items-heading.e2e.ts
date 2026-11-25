import { test, expect } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { LoginPage, testUserEmail } from "../pages/login-page";
import { ItemsPage } from "../pages/items-page";

test.describe("Items page heading", () => {
  test("signed-in user sees the heading All items on /items", async ({ page: rawPage }, testInfo) => {
    const page = newSkyrampPlaywrightPage(rawPage, testInfo);
    const login = new LoginPage(page);
    const items = new ItemsPage(page);

    await test.step("sign in at /login as the seeded test user", async () => {
      await login.goto();
      await login.signInAsTestUser();
      await expect(page).toHaveURL(/\/items$/);
      await items.waitForStatus();
      await expect.soft(items.userStatus()).toHaveText(`Signed in as ${testUserEmail()}`);
    });

    await test.step("the h1 reads exactly All items and no Items heading remains", async () => {
      await expect.soft(items.heading()).toHaveCount(1);
      await expect.soft(items.heading()).toHaveText("All items", { useInnerText: true });
      await expect.soft(items.headingNamed("Items")).toHaveCount(0);
    });
  });

  test("signed-out visitor reaching /items from the nav sees the heading All items", async ({ page: rawPage }, testInfo) => {
    const page = newSkyrampPlaywrightPage(rawPage, testInfo);
    const items = new ItemsPage(page);

    await test.step("open / and follow the Items nav link without signing in", async () => {
      await page.goto("/");
      await page.getByRole("link", { name: "Items", exact: true }).click();
      await expect(page).toHaveURL(/\/items$/);
      await items.waitForStatus();
    });

    await test.step("the h1 reads exactly All items and the status says not signed in", async () => {
      await expect.soft(items.heading()).toHaveCount(1);
      await expect.soft(items.heading()).toHaveText("All items", { useInnerText: true });
      await expect.soft(items.headingNamed("Items")).toHaveCount(0);
      await expect.soft(items.userStatus()).toHaveText("You are not signed in.");
    });
  });
});
