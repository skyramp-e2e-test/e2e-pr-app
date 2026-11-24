// The Items page: its heading, and each stored item listed by name.
import { test, expect } from "@playwright/test";
import { ItemsPage, uniqueSuffix } from "../support/items-page";

test("Items page heading reads All items", async ({ page }) => {
  const items = new ItemsPage(page);
  await items.signIn();
  await items.open();
  await expect(items.heading).toHaveText("All items");
  await expect(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
});

test("Items page lists every stored item by its name, in id order", async ({ page }) => {
  const items = new ItemsPage(page);
  const suffix = uniqueSuffix();
  const milk = `Milk-${suffix}`;
  const bread = `Bread-${suffix}`;
  await items.signIn();
  await items.addItem(milk);
  await items.addItem(bread);

  const api = await items.reload();
  const names = api.map((i) => i.name);
  expect(names.slice(-2)).toEqual([milk, bread]);
  const texts = await items.entryTexts(api);
  expect(texts).toEqual(names);
  expect(texts.slice(-2)).toEqual([milk, bread]);
  expect(texts.filter((t) => t.trim() === "")).toEqual([]);
});

test("An item added through the form is listed with its trimmed name without a reload", async ({ page }) => {
  const items = new ItemsPage(page);
  const bread = `Bread-${uniqueSuffix()}`;
  const before = await items.signIn();
  await expect(items.entries).toHaveCount(before.length);

  const { created, items: after } = await items.addItem(`  ${bread} `);
  expect(created.name).toBe(bread);
  expect(after.at(-1)?.id).toBe(created.id);
  await expect(items.entries).toHaveCount(before.length + 1);
  await expect.poll(async () => (await items.entries.allTextContents()).at(-1)).toBe(bread);
  await expect(items.newItemInput).toHaveValue("");
  await expect(items.error).toBeHidden();

  const reloaded = await items.reload();
  const texts = await items.entryTexts(reloaded);
  expect(texts).toEqual(reloaded.map((i) => i.name));
  expect(texts.at(-1)).toBe(bread);
});

test("An item name with markup is shown as literal text", async ({ page }) => {
  const items = new ItemsPage(page);
  const name = `<b>Tag</b>-${uniqueSuffix()}`;
  await items.signIn();
  const { created } = await items.addItem(name);
  expect(created.name).toBe(name);
  await expect.poll(async () => (await items.entries.allTextContents()).at(-1)).toBe(name);
  const entry = items.entries.filter({ hasText: name });
  await expect(entry).toHaveCount(1);
  expect(await entry.evaluate((el) => el.textContent)).toBe(name);
  expect(await entry.evaluate((el) => el.childElementCount)).toBe(0);
  expect(await items.entries.evaluateAll((els) => els.filter((el) => el.childElementCount > 0).length)).toBe(0);
});
