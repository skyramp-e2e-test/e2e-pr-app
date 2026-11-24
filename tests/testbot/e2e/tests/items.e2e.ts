// Items page: the heading, and the list showing every item by its name, on load and after adding one.
// Started from a Skyramp walk recording of the add-item flow, then strengthened by hand.
import { test, checkRequestPayload, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { APIRequestContext, Page } from "@playwright/test";

const appUrl = process.env.SKYRAMP_TEST_BASE_URL || "http://localhost:3000";
const pagesUrl = process.env.SKYRAMP_TEST_SERVICE_URL_UI || appUrl;

type Item = { id: number; name: string };

function credentials() {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in");
  }
  return { username, password };
}

async function listItems(request: APIRequestContext): Promise<Item[]> {
  const res = await request.get(`${appUrl}/api/items`);
  expect(res.status()).toBe(200);
  return res.json();
}

async function createItem(request: APIRequestContext, name: string): Promise<Item> {
  const res = await request.post(`${appUrl}/api/items`, { data: { name } });
  expect(res.status()).toBe(201);
  return res.json();
}

async function signIn(page: Page) {
  const { username, password } = credentials();
  await page.goto(`${pagesUrl}/login`);
  await page.getByLabel("Email").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/items$/);
  await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
}

async function addItemThroughForm(page: Page, name: string) {
  await page.getByLabel("New item").fill(name);
  const posted = page.waitForResponse(
    (r) => r.url().endsWith("/api/items") && r.request().method() === "POST",
  );
  const reloaded = page.waitForResponse(
    (r) => r.url().endsWith("/api/items") && r.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Add item" }).click();
  const response = await posted;
  checkRequestPayload(response.request().postDataJSON(), { name });
  expect(response.status()).toBe(201);
  await reloaded;
}

test.describe("Items page", () => {
  test.beforeEach(({ page }) => {
    page.setDefaultTimeout(10_000);
  });

  test("signs in, adds an item and sees every item listed by its name", async ({ page, request }) => {
    test.setTimeout(60_000);
    page = newSkyrampPlaywrightPage(page);
    const { username } = credentials();
    const newName = `Walk Item ${Date.now()}`;
    const items = page.getByTestId("item");
    let before: Item[] = [];

    await test.step("1. sign in on /login and land on /items", async () => {
      await signIn(page);
    });

    await test.step("2. view the Items page", async () => {
      before = await listItems(request);
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText("All items");
      await expect.soft(items).toHaveCount(before.length);
      await expect.soft(items).toHaveText(before.map((i) => i.name));
    });

    await test.step("3. add an item through the form", async () => {
      await addItemThroughForm(page, newName);
      await expect.soft(items).toHaveCount(before.length + 1);
      await expect.soft(items).toHaveText([...before.map((i) => i.name), newName]);
      await expect.soft(page.getByLabel("New item")).toHaveValue("");
      await expect.soft(page.getByTestId("item-error")).toBeHidden();
    });

    await test.step("4. reload the Items page", async () => {
      await page.reload();
      const after = await listItems(request);
      expect.soft(after.length).toBe(before.length + 1);
      expect.soft(after[after.length - 1].name).toBe(newName);
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText("All items");
      await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
      await expect.soft(page.getByTestId("item-error")).toBeHidden();
      await expect.soft(page.getByLabel("New item")).toHaveValue("");
      await expect.soft(items).toHaveCount(before.length + 1);
      await expect.soft(items).toHaveText(after.map((i) => i.name));
      await expect.soft(items.filter({ hasText: newName })).toHaveCount(1);
    });
  });

  test("lists each stored item by its name, in the order the API returns", async ({ page, request }) => {
    page = newSkyrampPlaywrightPage(page);
    const ts = Date.now();
    const lamp = await createItem(request, `Probe Lamp ${ts}`);
    const desk = await createItem(request, `Probe Desk ${ts}`);

    await page.goto(`${pagesUrl}/items`);
    const stored = await listItems(request);
    expect(stored.slice(-2).map((i) => i.id)).toEqual([lamp.id, desk.id]);

    const items = page.getByTestId("item");
    await expect(items).toHaveCount(stored.length);
    await expect(items).toHaveText(stored.map((i) => i.name));
    await expect(items.filter({ hasText: `Probe Lamp ${ts}` })).toHaveCount(1);
    await expect(items.filter({ hasText: `Probe Desk ${ts}` })).toHaveCount(1);
  });

  test("shows an item added through the form by its name, before and after a reload", async ({ page, request }) => {
    page = newSkyrampPlaywrightPage(page);
    const name = `Walk Item ${Date.now()}`;
    await signIn(page);
    const items = page.getByTestId("item");
    const before = await listItems(request);
    await expect(items).toHaveCount(before.length);

    await addItemThroughForm(page, name);
    await expect(page.getByLabel("New item")).toHaveValue("");
    await expect(page.getByTestId("item-error")).toBeHidden();
    await expect(items).toHaveCount(before.length + 1);
    await expect.soft(items).toHaveText([...before.map((i) => i.name), name]);

    await page.reload();
    await expect(items).toHaveCount(before.length + 1);
    await expect(items).toHaveText([...before.map((i) => i.name), name]);
  });

  test("heading reads All items", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await page.goto(`${pagesUrl}/items`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("All items");
    await expect(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
  });
});
