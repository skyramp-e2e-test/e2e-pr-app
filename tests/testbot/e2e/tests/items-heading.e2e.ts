// The Items page (GET /items) shows its main heading as 'All items', no longer 'Items'.
// Drafted with the Skyramp walk helper, then extended to check every step of each case.
import { test, expect, checkRequestPayload, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

test.use({ viewport: { width: 1280, height: 900 } });

function loginCredentials(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in');
  }
  return { email, password };
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(`${baseUrl}/items`);
}

async function expectAllItemsHeading(page: Page): Promise<void> {
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText('All items');
  await expect(page.getByRole('heading', { name: 'Items', exact: true })).toHaveCount(0);
}

test('signed-in user lands on /items whose only h1 reads All items', async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = loginCredentials();

  await signIn(page, email, password);
  await expect(page).toHaveURL(`${baseUrl}/items`);
  await expectAllItemsHeading(page);
});

test('signed-out /items page shows exactly one h1 reading All items', async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);

  await page.goto(`${baseUrl}/items`);
  await expectAllItemsHeading(page);
});

test('sign in, land on the All items page and add an item that persists after reload', async ({ page }) => {
  test.setTimeout(60000);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = loginCredentials();
  const itemName = `Journey item ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const items = page.getByTestId('items-list').getByTestId('item');
  const newItem = items.filter({ hasText: new RegExp(`^${itemName}$`) });

  await test.step('1. sign in on /login and get redirected to /items', async () => {
    await signIn(page, email, password);
    await expect.soft(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step('2. /items shows the All items heading and the signed-in user', async () => {
    const h1 = page.getByRole('heading', { level: 1 });
    await expect.soft(h1).toHaveCount(1);
    await expect.soft(h1).toHaveText('All items');
    await expect.soft(page.getByRole('heading', { name: 'Items', exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
  });

  await test.step('3. add a uniquely named item', async () => {
    await expect(newItem).toHaveCount(0);
    const input = page.getByLabel('New item');
    await input.fill(itemName);
    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith('/api/items') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Add item' }).click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect.soft(response.status()).toBe(201);
    await expect.soft(input).toHaveValue('');
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
    await expect.soft(newItem).toHaveCount(1);
    await expect.soft.poll(async () => (await items.allTextContents()).at(-1)).toBe(itemName);
  });

  await test.step('4. reload /items: heading and the new item persist', async () => {
    await page.reload();
    const h1 = page.getByRole('heading', { level: 1 });
    await expect.soft(h1).toHaveCount(1);
    await expect.soft(h1).toHaveText('All items');
    await expect.soft(page.getByRole('heading', { name: 'Items', exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
    await expect.soft(newItem).toHaveCount(1);
    await expect.soft.poll(async () => (await items.allTextContents()).at(-1)).toBe(itemName);
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
    await expect.soft(page.getByLabel('New item')).toHaveValue('');
  });
});
