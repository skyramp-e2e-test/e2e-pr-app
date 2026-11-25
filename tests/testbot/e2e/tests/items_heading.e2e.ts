import { test, expect, checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { ItemsPage, LoginPage } from "../pages/items-app";

// Items this test adds are named "Journey item <unique>"; the app has no delete API, so
// .skyramp/cleanup/remove-journey-items.sh removes them from the database after a run.
test("sign in, land on my items page headed Your items, and add an item", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const login = new LoginPage(page);
  const items = new ItemsPage(page);
  const name = `Journey item ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let email = "";
  let before: string[] = [];

  await test.step("1. sign in at /login and get redirected to /items", async () => {
    await login.goto();
    email = await login.signInAsTestUser();
    await expect.soft(page).toHaveURL(/\/items$/);
  });

  await test.step("2. the page after the redirect is headed Your items", async () => {
    await expect.soft(items.yourItemsHeading).toBeVisible();
    await expect.soft(items.levelOneHeadings).toHaveCount(1);
    await expect.soft(items.levelOneHeadings).toHaveText("Your items");
    await expect.soft(items.heading).toHaveText("Your items");
    await expect.soft(items.oldItemsHeading).toHaveCount(0);
    await expect.soft(items.userStatus).toHaveText(`Signed in as ${email}`);
  });

  await test.step("3. add an item from the Your items page", async () => {
    // The list has loaded once the GET /api/items the page fires has answered.
    await page.waitForLoadState("networkidle");
    before = await items.items.allTextContents();
    await items.newItem.fill(name);
    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith("/api/items") && r.request().method() === "POST",
    );
    await items.addItem.click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name });
    expect.soft(response.status()).toBe(201);
    await expect.soft(items.items.filter({ hasText: name })).toHaveCount(1);
    await expect.soft(items.items).toHaveText([...before, name]);
    await expect.soft(items.itemError).toBeHidden();
    await expect.soft(items.newItem).toHaveValue("");
    await expect.soft(items.heading).toHaveText("Your items");
  });

  await test.step("4. reload /items: heading, status and the new item persist", async () => {
    await page.reload();
    await expect.soft(items.levelOneHeadings).toHaveCount(1);
    await expect.soft(items.heading).toHaveText("Your items");
    await expect.soft(items.heading).toHaveJSProperty("tagName", "H1");
    await expect.soft(items.oldItemsHeading).toHaveCount(0);
    await expect.soft(items.userStatus).toHaveText(`Signed in as ${email}`);
    await expect.soft(items.items).toHaveText([...before, name]);
    await expect.soft(items.items.filter({ hasText: name })).toHaveCount(1);
    await expect.soft(items.itemError).toBeHidden();
    await expect.soft(items.newItem).toHaveValue("");
    await expect.soft(items.navHome).toHaveText("Home");
    await expect.soft(items.navLogin).toHaveText("Login");
    await expect.soft(items.navItems).toHaveText("Items");
    await expect.soft(items.signOut).toBeVisible();
  });
});
