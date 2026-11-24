// Browser tests of the Items page (/items): each stored item is listed by its name, and the heading reads 'All items'.
// Drafted with the Skyramp walk helper, then extended to check every part of each expected outcome.
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";

const baseUrl = process.env.SKYRAMP_TEST_SERVICE_URL_UI || process.env.SKYRAMP_TEST_BASE_URL || "http://localhost:3000";

type Item = { id: number; name: string; created_at: string };

// Item names are unique to each run, so a test finds the items it made even when the app already holds others.
const runId = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
const unique = (name: string) => `${name} ${runId}`;

function credentials() {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in");
  return { username, password };
}

const isItemsList = (url: string, method: string) => new URL(url).pathname === "/api/items" && method === "GET";

/** Signs in through /login and waits for /items to load its list. */
async function signIn(page: Page) {
  const { username, password } = credentials();
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill(username);
  await page.getByLabel("Password").fill(password);
  const listLoaded = page.waitForResponse((r) => isItemsList(r.url(), r.request().method()));
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
  await listLoaded;
  return username;
}

/** Reloads /items and waits for its list request to be answered. */
async function reloadItems(page: Page) {
  const listLoaded = page.waitForResponse((r) => isItemsList(r.url(), r.request().method()));
  await page.reload();
  await listLoaded;
}

/** Adds an item through the 'New item' form and checks the request the page sends. */
async function addItemThroughForm(page: Page, typed: string) {
  await page.getByLabel("New item").fill(typed);
  const saved = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/items" && r.request().method() === "POST");
  const reloaded = page.waitForResponse((r) => isItemsList(r.url(), r.request().method()));
  await page.getByRole("button", { name: "Add item" }).click();
  const response = await saved;
  checkRequestPayload(response.request().postDataJSON(), { name: typed });
  expect(response.status()).toBe(201);
  await reloaded;
}

async function apiItems(request: APIRequestContext): Promise<Item[]> {
  const res = await request.get(`${baseUrl}/api/items`);
  expect(res.status()).toBe(200);
  return res.json();
}

test.describe("Items page", () => {
  test.beforeEach(({ page }, testInfo) => {
    testInfo.setTimeout(60000);
    page.setDefaultTimeout(15000);
  });

  test("sign in, add items and see each one listed by name on the Items page", async ({ page: rawPage }) => {
    const page = newSkyrampPlaywrightPage(rawPage);
    const apples = unique("Apples");
    const bread = unique("Bread");
    const items = page.getByTestId("item");
    let username = "";

    await test.step("1. sign in at /login and land on /items", async () => {
      username = await signIn(page);
    });

    await test.step("2. the heading reads 'All items' and the user is signed in", async () => {
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText("All items");
      await expect.soft(page.getByRole("heading", { name: "All items" })).toHaveText("All items");
      await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
    });

    let countBefore = 0;
    await test.step("3. add 'Apples' through the form", async () => {
      countBefore = await items.count();
      await addItemThroughForm(page, apples);
      await expect.soft(page.getByLabel("New item")).toHaveValue("");
      await expect.soft(page.getByTestId("item-error")).toBeHidden();
      await expect.soft(items).toHaveCount(countBefore + 1);
      await expect.soft(page.getByTestId("items-list").getByText(apples, { exact: true })).toHaveCount(1);
    });

    await test.step("4. add 'Bread' through the form", async () => {
      await addItemThroughForm(page, bread);
      await expect.soft(page.getByLabel("New item")).toHaveValue("");
      await expect.soft(page.getByTestId("item-error")).toBeHidden();
      await expect.soft(items).toHaveCount(countBefore + 2);
      const texts = await items.allTextContents();
      expect.soft(texts.slice(-2)).toEqual([apples, bread]);
    });

    await test.step("5. reload: every stored item is listed by name, in id order", async () => {
      await reloadItems(page);
      const stored = await apiItems(page.request);
      expect.soft(stored.slice(-2).map((i) => i.name)).toEqual([apples, bread]);
      await expect.soft(items).toHaveCount(stored.length);
      expect.soft(await items.allTextContents()).toEqual(stored.map((i) => i.name));
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText("All items");
      await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
      await expect.soft(page.getByLabel("New item")).toHaveValue("");
      await expect.soft(page.getByTestId("item-error")).toBeHidden();
    });
  });

  test("each item from GET /api/items is listed with its name", async ({ page: rawPage }) => {
    const page = newSkyrampPlaywrightPage(rawPage);
    const apples = unique("Apples");
    const bread = unique("Bread");
    await signIn(page);
    await addItemThroughForm(page, apples);
    await addItemThroughForm(page, bread);

    const stored = await apiItems(page.request);
    const items = page.getByTestId("item");
    await expect(items).toHaveCount(stored.length);
    const texts = await items.allTextContents();
    expect(texts.slice(-2)).toEqual([apples, bread]);
    expect(texts).toEqual(stored.map((i) => i.name));
    expect(texts.filter((t) => t.trim() === "")).toEqual([]);
  });

  test("after a reload the list has one entry per stored item, in id order", async ({ page: rawPage }) => {
    const page = newSkyrampPlaywrightPage(rawPage);
    const cherry = unique("Cherry");
    const date = unique("Date");
    await signIn(page);
    for (const name of [cherry, date]) {
      const res = await page.request.post(`${baseUrl}/api/items`, { data: { name } });
      expect(res.status()).toBe(201);
      expect((await res.json()).name).toBe(name);
    }

    await reloadItems(page);
    const stored = await apiItems(page.request);
    const items = page.getByTestId("item");
    await expect(items).toHaveCount(stored.length);
    const texts = await items.allTextContents();
    expect(texts).toEqual(stored.map((i) => i.name));
    expect(texts.indexOf(cherry)).toBeGreaterThanOrEqual(0);
    expect(texts.indexOf(date)).toBe(texts.indexOf(cherry) + 1);
  });

  test("an item added through the form is listed by its trimmed name before and after a reload", async ({ page: rawPage }) => {
    const page = newSkyrampPlaywrightPage(rawPage);
    const figs = unique("Figs");
    await signIn(page);
    const items = page.getByTestId("item");
    const countBefore = await items.count();

    await addItemThroughForm(page, `  ${figs} `);
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expect.soft(items).toHaveCount(countBefore + 1);
    await expect.soft(page.getByTestId("items-list").getByText(figs, { exact: true })).toHaveCount(1);

    await reloadItems(page);
    await expect.soft(items).toHaveCount(countBefore + 1);
    await expect(page.getByTestId("items-list").getByText(figs, { exact: true })).toHaveCount(1);
  });

  test("the Items page heading reads 'All items'", async ({ page: rawPage }) => {
    const page = newSkyrampPlaywrightPage(rawPage);
    await signIn(page);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText("All items");
    await expect(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
  });
});
