// Journey: sign in, land on the Items page under its "All items" heading, add an item, reload.
import { test, expect } from "@playwright/test";
import { checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { ItemsPage, LoginPage, uiCredentials } from "../pages/items-app";

test("signed-in user adds an item under the All items heading and it stays after a reload", async ({ page }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = uiCredentials();
  const login = new LoginPage(page);
  const items = new ItemsPage(page);
  const newName = `Journey item ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  let before: string[] = [];

  await test.step("1. sign in at /login and get redirected to /items", async () => {
    await login.goto();
    await login.signInAs(username, password);
    await expect(page).toHaveURL(/\/items$/);
  });

  await test.step("2. the Items page shows the single All items heading and who is signed in", async () => {
    await expect.soft(items.mainHeadings).toHaveCount(1);
    await expect.soft(items.mainHeadings).toHaveText("All items");
    await expect.soft(items.heading("All items")).toBeVisible();
    await expect.soft(items.heading("Items")).toHaveCount(0);
    await expect.soft(items.userStatus).toHaveText(`Signed in as ${username}`);
    before = await items.loadedItemNames();
  });

  await test.step("3. add a new item", async () => {
    await items.newItem.fill(newName);
    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith("/api/items") && r.request().method() === "POST",
    );
    await items.addItem.click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name: newName });
    expect.soft(response.status()).toBe(201);
    await expect.soft(items.items).toHaveCount(before.length + 1);
    await expect.soft(items.items).toHaveText([...before, newName]);
    await expect.soft(items.newItem).toHaveValue("");
    await expect.soft(items.itemError).toBeHidden();
  });

  await test.step("4. reload /items: the heading, status, list and new item persist", async () => {
    await items.goto();
    await expect.soft(items.mainHeadings).toHaveCount(1);
    await expect.soft(items.mainHeadings).toHaveText("All items");
    await expect.soft(items.heading("All items")).toBeVisible();
    await expect.soft(items.heading("Items")).toHaveCount(0);
    await expect.soft(items.userStatus).toHaveText(`Signed in as ${username}`);
    await expect.soft(items.items).toHaveText([...before, newName]);
    await expect.soft(items.itemError).toBeHidden();
    await expect.soft(items.newItem).toHaveValue("");
  });
});
