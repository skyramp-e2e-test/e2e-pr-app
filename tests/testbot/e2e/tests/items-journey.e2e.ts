// Journey: sign in, add items and see each of them listed on the Items page.
import { test, expect } from "@playwright/test";
import { ItemsPage, baseUrl, uniqueSuffix, type ApiItem } from "../support/items-page";

test("sign in, add items and see each of them listed on the Items page", async ({ page }) => {
  test.setTimeout(60000);
  const items = new ItemsPage(page);
  const suffix = uniqueSuffix();
  const milk = `Milk-${suffix}`;
  const bread = `Bread-${suffix}`;
  const username = process.env.SKYRAMP_UI_USERNAME;
  let listed: ApiItem[] = [];

  await test.step("1. sign in at /login and land on /items", async () => {
    await page.goto(`${baseUrl}/login`);
    await expect(items.signInButton).toBeVisible();
    listed = await items.signIn();
    await expect(page).toHaveURL(/\/items$/);
  });

  await test.step("2. the Items page shows its heading, the user and every item by name", async () => {
    await expect.soft(items.heading).toHaveText("All items");
    await expect.soft(items.userStatus).toHaveText(`Signed in as ${username}`);
    await expect.soft(items.entries).toHaveCount(listed.length);
    expect.soft(await items.entries.allTextContents()).toEqual(listed.map((i) => i.name));
  });

  await test.step("3. add Milk through the form", async () => {
    const count = await items.entries.count();
    const { created, items: after } = await items.addItem(milk);
    expect.soft(created.name).toBe(milk);
    await expect.soft(items.entries).toHaveCount(count + 1);
    await expect.soft(items.newItemInput).toHaveValue("");
    await expect.soft(items.error).toBeHidden();
    await expect.configure({ soft: true }).poll(async () => (await items.entries.allTextContents()).at(-1)).toBe(milk);
    expect.soft(await items.entries.allTextContents()).toEqual(after.map((i) => i.name));
  });

  await test.step("4. add Bread with surrounding spaces through the form", async () => {
    const count = await items.entries.count();
    const { created } = await items.addItem(`  ${bread} `);
    expect.soft(created.name).toBe(bread);
    await expect.soft(items.entries).toHaveCount(count + 1);
    await expect.soft(items.newItemInput).toHaveValue("");
    await expect.soft(items.error).toBeHidden();
    expect.soft((await items.entries.allTextContents()).slice(-2)).toEqual([milk, bread]);
  });

  await test.step("5. after a reload the heading and the same entries are shown", async () => {
    const api = await items.reload();
    await expect(items.heading).toHaveText("All items");
    await expect(items.userStatus).toHaveText(`Signed in as ${username}`);
    await expect(items.error).toBeHidden();
    await expect(items.newItemInput).toHaveValue("");
    expect(api.map((i) => i.name).slice(-2)).toEqual([milk, bread]);
    const texts = await items.entryTexts(api);
    expect(texts).toEqual(api.map((i) => i.name));
    expect(texts.slice(-2)).toEqual([milk, bread]);
    expect(texts.filter((t) => t.trim() === "")).toEqual([]);
  });
});
