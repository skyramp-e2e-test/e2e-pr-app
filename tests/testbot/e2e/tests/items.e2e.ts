// Items page: its heading and the sign-in / add-item journey, against the running app.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const pageTimeout = 15000;
const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

test.use({
  viewport: { width: 1280, height: 900 },
});

function credentials(): { username: string; password: string } {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in as the seeded test user');
  }
  return { username, password };
}

// Fills the login form and submits it; resolves with the items the /items page loads after the redirect.
async function signIn(page: Page, username: string, password: string): Promise<string[]> {
  await page.getByLabel('Email').fill(username);
  await page.getByLabel('Password').fill(password);
  const itemsLoaded = page.waitForResponse(
    (res) => new URL(res.url()).pathname === '/api/items' && res.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Sign in' }).click();
  const items = (await (await itemsLoaded).json()) as { name: string }[];
  return items.map((item) => item.name);
}

test('Items page heading reads Your items', async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = credentials();

  await page.goto(`${baseUrl}/login`);
  await signIn(page, username, password);
  await expect(page).toHaveURL(`${baseUrl}/items`);

  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Your items');
  await expect(page.getByTestId('items-heading')).toHaveText('Your items');
  await expect(page.getByRole('heading', { level: 1, name: 'Items', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('nav-items')).toHaveText('Items');
});

test('sign in, open my items, and add an item', async ({ page }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = credentials();
  const name = `Journey item ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  let before: string[] = [];

  await test.step('1. open / and follow the Login link', async () => {
    await page.goto(`${baseUrl}/`);
    await page.getByTestId('nav-login').click();
    await expect(page).toHaveURL(`${baseUrl}/login`);
  });

  await test.step('2. sign in as the seeded test user', async () => {
    before = await signIn(page, username, password);
    await expect(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step('3. the Items page is headed Your items', async () => {
    await expect.soft(page.getByTestId('items-heading')).toHaveText('Your items');
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);
    await expect(page.getByTestId('item')).toHaveCount(before.length);
  });

  await test.step('4. add an item', async () => {
    await page.getByLabel('New item').fill(name);
    const created = page.waitForResponse(
      (res) => new URL(res.url()).pathname === '/api/items' && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Add item' }).click();
    const response = await created;
    checkRequestPayload(response.request().postDataJSON(), { name });
    expect.soft(response.status()).toBe(201);
    await expect.soft(page.getByLabel('New item')).toHaveValue('');
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
    await expect.soft(page.getByTestId('item')).toHaveCount(before.length + 1);
    await expect.soft(page.getByTestId('item').filter({ hasText: name })).toHaveText([name]);
  });

  await test.step('5. reload /items: the new item is still there', async () => {
    await page.reload();
    await expect(page).toHaveURL(`${baseUrl}/items`);
    await expect(page.getByTestId('items-heading')).toHaveText('Your items');
    await expect(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);
    await expect(page.getByTestId('item-error')).toBeHidden();
    await expect(page.getByTestId('item')).toHaveCount(before.length + 1);
    await expect(page.getByTestId('item').filter({ hasText: name })).toHaveText([name]);
    await expect(page.getByTestId('item')).toHaveText([...before, name]);
  });
});
