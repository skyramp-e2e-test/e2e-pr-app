// Items page: every item from GET /api/items is listed by name, in id order,
// on load and after adding one through the form.
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { test, expect, checkRequestPayload, newSkyrampPlaywrightPage } from '@skyramp/skyramp';

const baseUrl = process.env.SKYRAMP_TEST_SERVICE_URL_UI || process.env.SKYRAMP_TEST_BASE_URL || 'http://localhost:3000';
const apiUrl = process.env.SKYRAMP_TEST_BASE_URL || baseUrl;

type Item = { id: number; name: string };

function runId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function authHeaders(): Record<string, string> {
  return process.env.SKYRAMP_TEST_TOKEN ? { Authorization: `Bearer ${process.env.SKYRAMP_TEST_TOKEN}` } : {};
}

async function createItem(request: APIRequestContext, name: string): Promise<Item> {
  const res = await request.post(`${apiUrl}/api/items`, { data: { name }, headers: authHeaders() });
  expect(res.status()).toBe(201);
  const item = (await res.json()) as Item;
  expect(item.name).toBe(name);
  return item;
}

async function listItems(request: APIRequestContext): Promise<Item[]> {
  const res = await request.get(`${apiUrl}/api/items`, { headers: authHeaders() });
  expect(res.status()).toBe(200);
  return (await res.json()) as Item[];
}

function credentials(): { username: string; password: string } {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in');
  }
  return { username, password };
}

async function signIn(page: Page): Promise<string> {
  const { username, password } = credentials();
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('Email').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/items$/);
  await expect(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);
  return username;
}

// Opens /items (or reloads it) and returns the items its own GET /api/items answered with.
async function openItems(page: Page, how: 'goto' | 'reload' = 'goto'): Promise<Item[]> {
  const loaded = page.waitForResponse((r) => r.url().endsWith('/api/items') && r.request().method() === 'GET');
  if (how === 'reload') await page.reload();
  else await page.goto(`${baseUrl}/items`);
  return (await (await loaded).json()) as Item[];
}

// The list's order is what these checks read: the text of its final entry.
async function lastEntryText(entries: Locator): Promise<string | undefined> {
  const texts = await entries.allTextContents();
  return texts[texts.length - 1];
}

test.describe('Items page', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(10000);
  });

  test('lists every stored item by name in id order on load', async ({ page, request }) => {
    page = newSkyrampPlaywrightPage(page);
    const id = runId();
    const milk = await createItem(request, `Milk ${id}`);
    const bread = await createItem(request, `Bread ${id}`);

    await signIn(page);
    const shown = await openItems(page);
    const api = await listItems(request);

    // The page shows what the API holds, both seeded items included, in id order.
    expect(api.map((i) => i.id)).toEqual([...api.map((i) => i.id)].sort((a, b) => a - b));
    expect(api.map((i) => i.id)).toEqual(expect.arrayContaining([milk.id, bread.id]));
    expect(shown.map((i) => i.name)).toEqual(api.map((i) => i.name));

    const entries = page.getByTestId('items-list').getByTestId('item');
    await expect(entries).toHaveCount(api.length);
    await expect(entries).toHaveText(api.map((i) => i.name));
    await expect(entries.filter({ hasText: `Milk ${id}` })).toHaveText([`Milk ${id}`]);
    await expect(entries.filter({ hasText: `Bread ${id}` })).toHaveText([`Bread ${id}`]);
    await expect(entries.filter({ hasText: /^\s*$/ })).toHaveCount(0);
  });

  test('shows an item added with the form as the last entry, before and after reload', async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const name = `Eggs ${runId()}`;

    await signIn(page);
    const before = await openItems(page);
    const entries = page.getByTestId('items-list').getByTestId('item');
    await expect(entries).toHaveCount(before.length);

    const input = page.getByLabel('New item');
    await input.fill(`  ${name} `);
    const posted = page.waitForResponse((r) => r.url().endsWith('/api/items') && r.request().method() === 'POST');
    const reloaded = page.waitForResponse((r) => r.url().endsWith('/api/items') && r.request().method() === 'GET');
    await page.getByRole('button', { name: 'Add item' }).click();
    const postRes = await posted;
    checkRequestPayload(postRes.request().postDataJSON(), { name: `  ${name} ` });
    expect(postRes.status()).toBe(201);
    expect(((await postRes.json()) as Item).name).toBe(name);
    await reloaded;

    await expect(input).toHaveValue('');
    await expect(page.getByTestId('item-error')).toBeHidden();
    await expect(entries).toHaveCount(before.length + 1);
    await expect(entries.filter({ hasText: name })).toHaveText([name]);
    await expect.poll(() => lastEntryText(entries)).toBe(name);

    const after = await openItems(page, 'reload');
    expect(after[after.length - 1].name).toBe(name);
    await expect(entries).toHaveCount(after.length);
    await expect(entries.filter({ hasText: name })).toHaveText([name]);
    await expect.poll(() => lastEntryText(entries)).toBe(name);
  });

  test('journey: sign in, open Items, add an item and see it listed', async ({ page, request }) => {
    page = newSkyrampPlaywrightPage(page);
    const name = `Journey Bread ${runId()}`;
    const { username, password } = credentials();
    const entries = page.getByTestId('items-list').getByTestId('item');
    const input = page.getByLabel('New item');
    let countBefore = 0;

    await test.step('1. / - open the login form from the nav', async () => {
      await page.goto(`${baseUrl}/`);
      await page.getByTestId('nav-login').click();
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
    });

    let firstLoad: Promise<Item[]> = Promise.resolve([]);
    await test.step('2. /login - sign in and land on /items', async () => {
      await page.getByLabel('Email').fill(username);
      await page.getByLabel('Password').fill(password);
      firstLoad = page
        .waitForResponse((r) => r.url().endsWith('/api/items') && r.request().method() === 'GET')
        .then(async (r) => (await r.json()) as Item[]);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page).toHaveURL(/\/items$/);
      await expect(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);
    });

    await test.step('3. /items - the list shows every item by name in id order', async () => {
      const shown = await firstLoad;
      const api = await listItems(request);
      countBefore = shown.length;
      expect.soft(shown.map((i) => i.name)).toEqual(api.map((i) => i.name));
      await expect(entries).toHaveCount(shown.length);
      await expect.soft(entries).toHaveText(shown.map((i) => i.name));
    });

    await test.step('4. /items - add an item with the form', async () => {
      await input.fill(name);
      const posted = page.waitForResponse((r) => r.url().endsWith('/api/items') && r.request().method() === 'POST');
      const refreshed = page.waitForResponse((r) => r.url().endsWith('/api/items') && r.request().method() === 'GET');
      await page.getByRole('button', { name: 'Add item' }).click();
      const postRes = await posted;
      checkRequestPayload(postRes.request().postDataJSON(), { name });
      expect(postRes.status()).toBe(201);
      await refreshed;
      await expect.soft(input).toHaveValue('');
      await expect.soft(page.getByTestId('item-error')).toBeHidden();
      await expect.soft(entries).toHaveCount(countBefore + 1);
      await expect.soft(entries.filter({ hasText: name })).toHaveText([name]);
      await expect.configure({ soft: true }).poll(() => lastEntryText(entries)).toBe(name);
    });

    await test.step('5. /items - after reload the list still shows every name, the new one last', async () => {
      const after = await openItems(page, 'reload');
      const api = await listItems(request);
      expect.soft(after.map((i) => i.name)).toEqual(api.map((i) => i.name));
      expect.soft(after[after.length - 1].name).toBe(name);
      await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);
      await expect.soft(page.getByTestId('item-error')).toBeHidden();
      await expect.soft(input).toHaveValue('');
      await expect.soft(entries).toHaveCount(after.length);
      await expect.soft(entries).toHaveText(after.map((i) => i.name));
      await expect.soft(entries.filter({ hasText: name })).toHaveText([name]);
      await expect.configure({ soft: true }).poll(() => lastEntryText(entries)).toBe(name);
    });
  });
});
