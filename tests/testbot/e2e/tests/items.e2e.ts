// Items page: each entry in the list shows its item's name.
import { test, expect, checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { APIRequestContext, Page } from "@playwright/test";

const baseUrl = process.env.SKYRAMP_TEST_BASE_URL || "http://localhost:3000";

test.use({ viewport: { width: 1280, height: 900 } });

type Item = { id: number; name: string; created_at: string };

async function createItem(request: APIRequestContext, name: string): Promise<Item> {
  const res = await request.post(`${baseUrl}/api/items`, { data: { name } });
  expect(res.status()).toBe(201);
  const item = (await res.json()) as Item;
  expect(item.name).toBe(name);
  return item;
}

async function apiItemNames(request: APIRequestContext): Promise<string[]> {
  const res = await request.get(`${baseUrl}/api/items`);
  expect(res.status()).toBe(200);
  return ((await res.json()) as Item[]).map((item) => item.name);
}

function itemsPage(page: Page) {
  return {
    list: page.getByTestId("items-list"),
    entries: page.getByTestId("items-list").getByTestId("item"),
    newItemInput: page.getByLabel("New item"),
    addItemButton: page.getByRole("button", { name: "Add item" }),
    error: page.getByTestId("item-error"),
    userStatus: page.getByTestId("user-status"),
  };
}

// The list shows exactly one entry per item GET /api/items returns, in its order, each reading the item's name.
// Retried as a whole, so a list still rendering (or an item another test adds meanwhile) settles before it fails.
async function expectListMatchesApi(page: Page, request: APIRequestContext) {
  const { entries } = itemsPage(page);
  await expect(async () => {
    const names = await apiItemNames(request);
    const texts = await entries.allTextContents();
    expect(texts).toEqual(names);
  }).toPass({ timeout: 10_000 });
}

// The list's last entry reads exactly `name`: the order is what this checks, so it reads the entries' texts in order.
async function expectLastEntry(page: Page, name: string, soft = false) {
  const { entries } = itemsPage(page);
  const lastIsName = async () => {
    const texts = await entries.allTextContents();
    expect(texts[texts.length - 1]).toBe(name);
  };
  if (soft) await expect.soft(lastIsName).toPass({ timeout: 5_000 });
  else await expect(lastIsName).toPass({ timeout: 5_000 });
}

test("Items page lists every item by its name, in the order the API returns them", async ({ page, request }) => {
  page = newSkyrampPlaywrightPage(page);
  const ts = Date.now();
  const nameA = `Plan-A-${ts}`;
  const nameB = `Plan-B-${ts}`;
  await createItem(request, nameA);
  await createItem(request, nameB);

  await page.goto(`${baseUrl}/items`);
  const items = itemsPage(page);
  await expect(items.list).toBeVisible();

  await expectListMatchesApi(page, request);
  await expect(items.entries.filter({ hasText: nameA })).toHaveText([nameA]);
  await expect(items.entries.filter({ hasText: nameB })).toHaveText([nameB]);
  await expect(items.entries.filter({ hasText: nameA })).toBeVisible();
  await expect(items.entries.filter({ hasText: nameB })).toBeVisible();
});

test("Adding an item through the form shows it by name at the end of the list without a reload", async ({ page, request }) => {
  page = newSkyrampPlaywrightPage(page);
  const name = `Plan-C-${Date.now()}`;

  await page.goto(`${baseUrl}/items`);
  const items = itemsPage(page);
  await expect(items.list).toBeVisible();

  await items.newItemInput.fill(name);
  const postResponse = page.waitForResponse(
    (res) => res.url().endsWith("/api/items") && res.request().method() === "POST",
  );
  await items.addItemButton.click();
  const response = await postResponse;
  checkRequestPayload(response.request().postDataJSON(), { name });
  expect(response.status()).toBe(201);

  await expect(items.newItemInput).toHaveValue("");
  await expect(items.error).toBeHidden();
  await expectLastEntry(page, name);
  await expectListMatchesApi(page, request);
});

test("No entry on the Items page is blank", async ({ page, request }) => {
  page = newSkyrampPlaywrightPage(page);
  const name = `Blank-check-${Date.now()}`;
  await createItem(request, name);

  const itemsLoaded = page.waitForResponse(
    (res) => res.url().endsWith("/api/items") && res.request().method() === "GET",
  );
  await page.goto(`${baseUrl}/items`);
  const items = itemsPage(page);
  await itemsLoaded;

  await expect(items.entries.filter({ hasText: /^\s*$/ })).toHaveCount(0);
  await expect(items.entries.filter({ hasText: name })).toHaveText([name]);
});

test("Journey: sign in, add an item on the Items page and see it listed by name", async ({ page, request }) => {
  page = newSkyrampPlaywrightPage(page);
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: this test signs in through the login page");
  }
  const name = `Journey-${Date.now()}`;
  const items = itemsPage(page);

  await test.step("1. sign in on /login", async () => {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel("Email").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(`${baseUrl}/items`);
    await expect(items.userStatus).toHaveText(`Signed in as ${username}`);
  });

  await test.step("2. the Items list shows each item by name", async () => {
    await expect(items.list).toBeVisible();
    await expect.soft(async () => {
      expect(await items.entries.allTextContents()).toEqual(await apiItemNames(request));
    }).toPass({ timeout: 10_000 });
  });

  await test.step("3. add an item through the form", async () => {
    await items.newItemInput.fill(name);
    const postResponse = page.waitForResponse(
      (res) => res.url().endsWith("/api/items") && res.request().method() === "POST",
    );
    await items.addItemButton.click();
    const response = await postResponse;
    checkRequestPayload(response.request().postDataJSON(), { name });
    expect(response.status()).toBe(201);
    await expect(items.newItemInput).toHaveValue("");
    await expect(items.error).toBeHidden();
    await expectLastEntry(page, name, true);
  });

  await test.step("4. after a reload the list still ends with the new item and shows every name", async () => {
    await page.reload();
    await expect(items.userStatus).toHaveText(`Signed in as ${username}`);
    await expect(items.error).toBeHidden();
    await expect(items.newItemInput).toHaveValue("");
    await expectLastEntry(page, name);
    await expectListMatchesApi(page, request);
  });
});
