// The Items page heading reads "Your items" and the old "Items" heading is gone.
import { test, expect } from "@playwright/test";
import { ItemsPage, LoginPage, skyrampPage } from "../support/items-page";

test.describe("Items page heading", () => {
  let items: ItemsPage;

  test.beforeEach(async ({ page }) => {
    page = skyrampPage(page);
    const login = new LoginPage(page);
    items = new ItemsPage(page);
    await login.goto();
    const listLoaded = items.waitForList();
    await login.signInAsTestUser();
    await listLoaded;
  });

  test('signed-in user sees the page heading "Your items"', async () => {
    await expect(items.heading).toHaveCount(1);
    await expect(items.heading).toHaveText("Your items");
  });

  test('the old heading "Items" is gone while the nav link still reads "Items"', async () => {
    await expect(items.heading).toHaveText("Your items");
    await expect(items.oldHeading).toHaveCount(0);
    await expect(items.navItems).toHaveText("Items");
  });
});
