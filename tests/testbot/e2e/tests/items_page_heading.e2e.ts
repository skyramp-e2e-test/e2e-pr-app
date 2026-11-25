import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { ItemsPage, LoginPage } from "../pages/items-app";

test.describe("Items page heading", () => {
  test("a signed-in user sees the Items page headed exactly Your items, also after a reload", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const login = new LoginPage(page);
    const items = new ItemsPage(page);

    await test.step("sign in and land on /items", async () => {
      await login.goto();
      await login.signInAsTestUser();
      await expect(page).toHaveURL(/\/items$/);
    });

    for (const when of ["after sign-in", "after reloading /items"]) {
      if (when !== "after sign-in") await items.goto();
      await test.step(`heading reads Your items ${when}`, async () => {
        await expect.soft(items.levelOneHeadings).toHaveCount(1);
        await expect.soft(items.levelOneHeadings).toHaveText("Your items");
        await expect.soft(items.yourItemsHeading).toHaveCount(1);
        await expect.soft(items.yourItemsHeading).toBeVisible();
        await expect.soft(items.oldItemsHeading).toHaveCount(0);
        // The nav link still reads Items, but it is a link, not the heading.
        await expect.soft(items.navItems).toHaveText("Items");
        await expect.soft(items.navItems).toHaveJSProperty("tagName", "A");
      });
    }
  });

  test("the signed-in Items page heading is the one h1 with test id items-heading", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const login = new LoginPage(page);
    const items = new ItemsPage(page);

    await login.goto();
    await login.signInAsTestUser();
    await expect(items.heading).toHaveCount(1);
    await expect(items.heading).toHaveJSProperty("tagName", "H1");
    await expect(items.heading).toHaveText("Your items");
  });

  test("the Items page served without signing in carries the items-heading h1 reading Your items", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const items = new ItemsPage(page);

    await items.goto();
    await expect(items.userStatus).toHaveText("You are not signed in.");
    await expect(items.heading).toHaveCount(1);
    await expect(items.heading).toHaveJSProperty("tagName", "H1");
    await expect(items.heading).toHaveText("Your items");
  });
});
