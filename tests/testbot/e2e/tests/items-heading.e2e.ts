import { test, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

function credentials() {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through /login');
  }
  return { username, password };
}

// Opens Home, follows the Login link and signs in; the app redirects to /items.
async function signInFromHome(page: Page, username: string, password: string) {
  await page.goto(`${baseUrl}/`);
  await page.getByTestId('nav-login').click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByLabel('Email').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
}

test('signed-in Items page has one level-1 heading reading Your items', async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = credentials();
  await signInFromHome(page, username, password);

  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText('Your items');
  await expect(page.getByTestId('items-heading')).toHaveText('Your items');
  await expect(page.getByRole('heading', { level: 1, name: 'Items', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);
});

test('signed-out Items page is also headed Your items', async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await page.goto(`${baseUrl}/`);
  await page.getByTestId('nav-items').click();
  await expect(page).toHaveURL(`${baseUrl}/items`);

  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText('Your items');
  await expect(page.getByTestId('user-status')).toHaveText('You are not signed in.');
});

test('user signs in, sees Your items, adds a 50-character item that stays after reload', async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = credentials();
  // Unique per run, exactly 50 characters: the longest name the API accepts.
  const name = `j${Date.now().toString(36)}`.padEnd(50, 'x');
  expect(name).toHaveLength(50);
  const items = page.getByTestId('item');
  const withName = page.getByTestId('items-list').getByText(name, { exact: true });
  let before = 0;

  await test.step('1. Home: follow the Login link', async () => {
    await page.goto(`${baseUrl}/`);
    await page.getByTestId('nav-login').click();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  await test.step('2. Login: sign in and land on /items', async () => {
    await page.getByLabel('Email').fill(username);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step('3. Items: heading reads Your items, status shows the user', async () => {
    await expect.soft(page.getByTestId('items-heading')).toHaveText('Your items');
    await expect.soft(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);
  });

  await test.step('4. Items: add a 50-character item', async () => {
    // The list is filled from GET /api/items once the page loads.
    const fromApi = await (await page.request.get(`${baseUrl}/api/items`)).json();
    await expect(items).toHaveCount(fromApi.length);
    before = fromApi.length;

    await page.getByLabel('New item').fill(name);
    const posted = page.waitForResponse((r) => r.url().endsWith('/api/items') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Add item' }).click();
    const res = await posted;
    expect.soft(res.request().postDataJSON()).toEqual({ name });
    expect.soft(res.status()).toBe(201);

    await expect.soft(page.getByLabel('New item')).toHaveValue('');
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
    await expect.soft(items).toHaveCount(before + 1);
    // The list is in id order; step 5 checks it whole against GET /api/items.
    await expect.soft(withName).toHaveCount(1);
  });

  await test.step('5. Items: reload, the item and heading persist', async () => {
    await page.reload();
    await expect(page.getByTestId('items-heading')).toHaveText('Your items');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);
    await expect(page.getByTestId('item-error')).toBeHidden();
    const fromApi: { name: string }[] = await (await page.request.get(`${baseUrl}/api/items`)).json();
    await expect(items).toHaveText(fromApi.map((i) => i.name));
    await expect(items).toHaveCount(before + 1);
    await expect(withName).toHaveText(name);
    await expect(withName).toHaveCount(1);
  });
});
