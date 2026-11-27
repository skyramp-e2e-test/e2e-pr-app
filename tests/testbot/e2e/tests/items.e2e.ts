// Items page (public/items.html): heading, the list of stored items by name, and the add-item form.
import { test, expect, checkRequestPayload, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";

const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

// Items the tests create carry this prefix, so .skyramp/cleanup can find them (the app has no delete endpoint).
const unique = (label: string) => `${label} e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

function credentials() {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in");
  }
  return { username, password };
}

async function apiItemNames(page: Page): Promise<string[]> {
  const res = await page.request.get(`${baseUrl}/api/items`);
  expect(res.status()).toBe(200);
  return ((await res.json()) as { name: string }[]).map((item) => item.name);
}

async function waitForItemsLoaded(page: Page) {
  await page.waitForResponse((res) => res.url().endsWith("/api/items") && res.request().method() === "GET");
}

test.use({ viewport: { width: 1280, height: 900 } });

test("Items page heading reads All items", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await page.goto(`${baseUrl}/items`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("All items");
});

test("Items page lists each stored item by its name", async ({ page, request }) => {
  page = newSkyrampPlaywrightPage(page);
  const name = unique("Plan Milk");
  const created = await request.post(`${baseUrl}/api/items`, { data: { name } });
  expect(created.status()).toBe(201);

  const loaded = waitForItemsLoaded(page);
  await page.goto(`${baseUrl}/items`);
  await loaded;
  const names = await apiItemNames(page);
  expect(names).toContain(name);

  const entries = page.getByTestId("items-list").getByTestId("item");
  await expect(entries).toHaveCount(names.length);
  // One entry per API item, in id order, each reading that item's name (none blank).
  await expect(entries).toHaveText(names);
  await expect(entries.filter({ hasText: name })).toHaveText([name]);
});

test("Adding an item with the form shows it by its trimmed name without a reload", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const name = unique("Plan Bread");
  const loaded = waitForItemsLoaded(page);
  await page.goto(`${baseUrl}/items`);
  await loaded;

  const input = page.getByLabel("New item");
  await input.fill(`  ${name}  `);
  const responsePromise = page.waitForResponse((res) => res.url().endsWith("/api/items") && res.request().method() === "POST");
  const reloaded = page.waitForResponse((res) => res.url().endsWith("/api/items") && res.request().method() === "GET");
  await page.getByRole("button", { name: "Add item" }).click();
  const response = await responsePromise;
  checkRequestPayload(response.request().postDataJSON(), { name: `  ${name}  ` });
  expect(response.status()).toBe(201);
  expect((await response.json()).name).toBe(name);
  await reloaded;

  const entries = page.getByTestId("items-list").getByTestId("item");
  await expect.soft(entries.filter({ hasText: name })).toHaveText(name);
  await expect.soft(input).toHaveValue("");
  await expect.soft(page.getByTestId("item-error")).toBeHidden();

  await page.reload();
  await expect(entries.filter({ hasText: name })).toHaveText(name);
});

test("Signed-in user opens the Items page and adds an item", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = credentials();
  const name = unique("Plan Bread");
  const entries = page.getByTestId("items-list").getByTestId("item");
  const input = page.getByLabel("New item");

  await test.step("1. sign in on /login", async () => {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel("Email").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step("2. look at the Items page", async () => {
    await expect.soft(page.getByRole("heading", { name: "All items", level: 1 })).toBeVisible();
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
    const names = await apiItemNames(page);
    await expect.soft(entries).toHaveCount(names.length);
    await expect.soft(entries).toHaveText(names);
  });

  await test.step("3. add an item with the form", async () => {
    await input.fill(`  ${name}  `);
    const responsePromise = page.waitForResponse((res) => res.url().endsWith("/api/items") && res.request().method() === "POST");
    await page.getByRole("button", { name: "Add item" }).click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name: `  ${name}  ` });
    expect.soft(response.status()).toBe(201);
    await expect.soft(entries.filter({ hasText: name })).toHaveText(name);
    await expect.soft(input).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
  });

  await test.step("4. reload the page", async () => {
    await page.reload();
    await expect.soft(page.getByRole("heading", { name: "All items", level: 1 })).toBeVisible();
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
    const names = await apiItemNames(page);
    expect.soft(names[names.length - 1]).toBe(name);
    await expect.soft(entries).toHaveText(names);
    await expect.soft(entries.filter({ hasText: name })).toHaveText(name);
    await expect.soft(input).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
  });
});
