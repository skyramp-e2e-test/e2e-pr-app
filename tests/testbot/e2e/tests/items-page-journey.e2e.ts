// Journey: sign in, see the Items list, add an item and find it again after a reload.
import { test, expect } from "@playwright/test";
import { checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { ItemsPage, LoginPage, uniqueName, type StoredItem } from "../pages/items-pages";

test("signed-in user sees every item by name and adds one that stays listed after a reload", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  page.setDefaultTimeout(15000);
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set");
  const login = new LoginPage(page);
  const items = new ItemsPage(page);
  const name = uniqueName("Journey Lamp");
  let loaded: StoredItem[] = [];

  await test.step("1. sign in on /login and land on /items", async () => {
    await login.goto();
    const firstLoad = items.waitForItemsLoad();
    await login.signInAs(email, password);
    await expect(page).toHaveURL(/\/items$/);
    await expect.soft(items.userStatus).toHaveText(`Signed in as ${email}`);
    loaded = (await (await firstLoad).json()) as StoredItem[];
  });

  await test.step("2. the list shows one entry per stored item, each by its name in id order", async () => {
    await expect.soft(items.entries).toHaveCount(loaded.length);
    await expect.soft(items.entries).toHaveText(loaded.map((i) => i.name));
  });

  await test.step("3. add an item with the form; it is the last entry, input cleared, no error", async () => {
    await items.newItem.fill(name);
    const posted = page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/items",
    );
    const reloaded = items.waitForItemsLoad();
    await items.addItem.click();
    const response = await posted;
    checkRequestPayload(response.request().postDataJSON(), { name });
    expect(response.status()).toBe(201);
    const after = ((await (await reloaded).json()) as StoredItem[]).map((i) => i.name);
    expect.soft(after[after.length - 1]).toBe(name);
    await expect.soft(items.entries).toHaveCount(loaded.length + 1);
    await expect.soft(items.entry(name)).toHaveText(name);
    // The added item is the last entry: the list reads the refreshed names in order, ending with it.
    await expect.soft(items.entries).toHaveText(after);
    await expect.soft(items.newItem).toHaveValue("");
    await expect.soft(items.error).toBeHidden();
  });

  await test.step("4. after a reload the added item is still the last entry and no entry is blank", async () => {
    const stored = await items.reload();
    const names = stored.map((i) => i.name);
    expect.soft(names[names.length - 1]).toBe(name);
    await expect.soft(items.entry(name)).toHaveText(name);
    await expect.soft(items.entries).toHaveText(names);
    await expect.soft(items.userStatus).toHaveText(`Signed in as ${email}`);
    await expect.soft(items.newItem).toHaveValue("");
    await expect.soft(items.error).toBeHidden();
  });
});
