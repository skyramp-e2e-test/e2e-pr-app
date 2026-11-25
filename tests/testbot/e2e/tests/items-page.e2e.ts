// The Items page lists every stored item by its name: on load, after adding one through the form, and after a reload.
import { test, expect } from "@playwright/test";
import { checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { ItemsPage, createItem, uniqueName } from "../pages/items-pages";

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15000);
});

test("lists every stored item by name, in the order the API returns them", async ({ page, request }) => {
  page = newSkyrampPlaywrightPage(page);
  const items = new ItemsPage(page);
  const lamp = uniqueName("Probe Lamp");
  const desk = uniqueName("Probe Desk");
  await createItem(request, lamp);
  await createItem(request, desk);

  const stored = await items.open();
  const names = stored.map((i) => i.name);
  expect(names).toContain(lamp);
  expect(names).toContain(desk);
  expect(names.indexOf(lamp)).toBeLessThan(names.indexOf(desk));

  // One entry per stored item; entry i reads the i-th item's name.
  await expect(items.entries).toHaveCount(stored.length);
  await expect(items.entries).toHaveText(names);
  await expect(items.entry(lamp)).toHaveText(lamp);
  await expect(items.entry(desk)).toHaveText(desk);
});

test("an item added with the form appears as the last entry, by its trimmed name, without a reload", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const items = new ItemsPage(page);
  const name = uniqueName("Probe Chair");
  const before = await items.open();
  await expect(items.entries).toHaveCount(before.length);

  await items.newItem.fill(`  ${name}  `);
  const posted = page.waitForResponse(
    (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/items",
  );
  const reloaded = items.waitForItemsLoad();
  await items.addItem.click();
  const response = await posted;
  checkRequestPayload(response.request().postDataJSON(), { name: `  ${name}  ` });
  expect(response.status()).toBe(201);
  const after = ((await (await reloaded).json()) as { name: string }[]).map((i) => i.name);
  expect(after[after.length - 1]).toBe(name);

  expect.soft(page.url()).toBe(`${new URL(page.url()).origin}/items`);
  await expect.soft(items.entries).toHaveCount(before.length + 1);
  await expect.soft(items.entry(name)).toHaveText(name);
  // The added item is the last entry: the list reads the refreshed names in order, ending with it.
  await expect.soft(items.entries).toHaveText(after);
  await expect.soft(items.newItem).toHaveValue("");
  await expect.soft(items.error).toBeHidden();
});

test("items added earlier are still listed by name after the page is reloaded", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const items = new ItemsPage(page);
  const name = uniqueName("Probe Shelf");
  await items.open();
  const reloadedAfterAdd = items.waitForItemsLoad();
  await items.newItem.fill(name);
  await items.addItem.click();
  await reloadedAfterAdd;

  const stored = await items.reload();
  const names = stored.map((i) => i.name);
  expect(names[names.length - 1]).toBe(name);
  await expect.soft(items.entry(name)).toHaveText(name);
  // The added item is still the last entry, and every other entry still reads its item's name.
  await expect.soft(items.entries).toHaveText(names);
});

test("an item created through the API is shown by its exact name, and no entry is blank", async ({ page, request }) => {
  page = newSkyrampPlaywrightPage(page);
  const items = new ItemsPage(page);
  const name = uniqueName("Probe Lamp");
  await createItem(request, name);

  const stored = await items.open();
  await expect(items.entries).toHaveCount(stored.length);
  await expect.soft(items.entry(name)).toBeVisible();
  await expect.soft(items.entry(name)).toHaveText(name);
  const texts = await items.entries.allTextContents();
  expect.soft(texts.filter((t) => t.trim() === "")).toEqual([]);
});
