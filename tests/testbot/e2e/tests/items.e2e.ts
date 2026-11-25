// Items page (public/items.html): each stored item is listed by its name, on load and right after adding one.
// Started from a Skyramp walk of the sign-in and Add item flow against the running app.
import type { APIRequestContext, Page } from "@playwright/test";
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";

const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");
const pageTimeout = 15000;

test.use({ viewport: { width: 1280, height: 900 } });

type Item = { id: number; name: string; created_at: string };

function authHeaders(): Record<string, string> {
  return process.env.SKYRAMP_TEST_TOKEN ? { Authorization: `Bearer ${process.env.SKYRAMP_TEST_TOKEN}` } : {};
}

async function createItem(request: APIRequestContext, name: string): Promise<Item> {
  const res = await request.post(`${baseUrl}/api/items`, { data: { name }, headers: authHeaders() });
  expect(res.status()).toBe(201);
  const item = (await res.json()) as Item;
  expect(item.name).toBe(name);
  return item;
}

async function listItems(request: APIRequestContext): Promise<Item[]> {
  const res = await request.get(`${baseUrl}/api/items`, { headers: authHeaders() });
  expect(res.status()).toBe(200);
  return (await res.json()) as Item[];
}

function uiCredentials(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through /login");
  }
  return { email, password };
}

async function openItemsPage(page: Page): Promise<void> {
  const loaded = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "GET");
  await page.goto(`${baseUrl}/items`);
  await loaded;
}

async function signIn(page: Page): Promise<string> {
  const { email, password } = uiCredentials();
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  const loaded = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "GET");
  await page.getByRole("button", { name: "Sign in" }).click();
  await loaded;
  return email;
}

// Adds an item through the New item form and checks the request the page sends.
async function addItemThroughForm(page: Page, typed: string): Promise<void> {
  await page.getByLabel("New item").fill(typed);
  const posted = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "POST");
  const reloaded = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "GET");
  await page.getByRole("button", { name: "Add item" }).click();
  const response = await posted;
  checkRequestPayload(response.request().postDataJSON(), { name: typed });
  expect(response.status()).toBe(201);
  await reloaded;
}

test("Items page lists every stored item by its name, in API order, on load", async ({ page, request }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);

  const ts = Date.now();
  const nameA = `Plan item A ${ts}`;
  const nameB = `Plan item B ${ts}`;
  await createItem(request, nameA);
  await createItem(request, nameB);

  await openItemsPage(page);
  const apiItems = await listItems(request);
  const names = apiItems.map((i) => i.name);
  expect(names.slice(-2)).toEqual([nameA, nameB]);

  const list = page.getByTestId("items-list");
  const entries = list.getByTestId("item");
  await expect(list).toBeVisible();
  await expect(entries).toHaveCount(apiItems.length);
  // One entry per item, entry i reading item i's name exactly (a blank entry fails here).
  await expect(entries).toHaveText(names, { useInnerText: true });
  await expect(list.getByText(nameA, { exact: true })).toHaveCount(1);
  await expect(list.getByText(nameB, { exact: true })).toHaveCount(1);
});

test("Adding an item through the New item form lists its trimmed name as the last entry, also after a reload", async ({ page, request }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);

  const ts = Date.now();
  const bread = `Bread ${ts}`;
  await signIn(page);
  const before = (await listItems(request)).length;
  const list = page.getByTestId("items-list");
  const entries = list.getByTestId("item");
  await expect(entries).toHaveCount(before);

  await addItemThroughForm(page, `  ${bread} `);

  await expect(page.getByLabel("New item")).toHaveValue("");
  await expect(page.getByTestId("item-error")).toBeHidden();
  await expect(entries).toHaveCount(before + 1);
  const saved = await listItems(request);
  expect(saved).toHaveLength(before + 1);
  expect(saved[saved.length - 1].name).toBe(bread);
  // The list, in order, ends with the added item's trimmed name.
  await expect(entries).toHaveText(saved.map((i) => i.name), { useInnerText: true });
  await expect(list.getByText(bread, { exact: true })).toHaveCount(1);

  await openItemsPage(page);
  await expect(entries).toHaveCount(before + 1);
  await expect(entries).toHaveText(saved.map((i) => i.name), { useInnerText: true });
  await expect(list.getByText(bread, { exact: true })).toHaveCount(1);
});

test("Signed-in user adds an item and sees every item listed by name on the Items page", async ({ page, request }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);

  const ts = Date.now();
  const bread = `Bread ${ts}`;
  const seeded = `Journey item ${ts}`;
  await createItem(request, seeded);
  const { email } = uiCredentials();
  const list = page.getByTestId("items-list");
  const entries = list.getByTestId("item");
  let start = 0;

  await test.step("1. sign in at /login and land on /items", async () => {
    await signIn(page);
    await expect.soft(page).toHaveURL(`${baseUrl}/items`);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  });

  await test.step("2. the list shows each stored item by name, in API order", async () => {
    await expect(page.getByTestId("items-list")).toBeVisible();
    const apiItems = await listItems(request);
    start = apiItems.length;
    expect(apiItems[apiItems.length - 1].name).toBe(seeded);
    await expect.soft(entries).toHaveCount(start);
    await expect.soft(entries).toHaveText(apiItems.map((i) => i.name), { useInnerText: true });
  });

  await test.step("3. add '  Bread <ts> ' through the New item form", async () => {
    await addItemThroughForm(page, `  ${bread} `);
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expect.soft(entries).toHaveCount(start + 1);
    const afterAdd = await listItems(request);
    expect.soft(afterAdd[afterAdd.length - 1].name).toBe(bread);
    await expect.soft(entries).toHaveText(afterAdd.map((i) => i.name), { useInnerText: true });
    await expect.soft(list.getByText(bread, { exact: true })).toHaveCount(1);
  });

  await test.step("4. after a reload the list still ends with the added item", async () => {
    await openItemsPage(page);
    const apiItems = await listItems(request);
    expect.soft(apiItems).toHaveLength(start + 1);
    expect.soft(apiItems[apiItems.length - 1].name).toBe(bread);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expect.soft(entries).toHaveCount(start + 1);
    await expect.soft(entries).toHaveText(apiItems.map((i) => i.name), { useInnerText: true });
    await expect.soft(list.getByText(bread, { exact: true })).toHaveCount(1);
  });
});
