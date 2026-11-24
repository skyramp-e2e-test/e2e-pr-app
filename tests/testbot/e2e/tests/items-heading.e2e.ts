// Browser tests of the Items page heading ("Your items"), recorded with the Skyramp walk helper and
// strengthened by hand. They run against the real app and sign in as the seeded test user.
import { test, checkRequestPayload, expect, getBaseUrl, getValue, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const pageTimeout = 15000;

// URL for test requests
const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

test.use({
  viewport: { width: 1280, height: 900 },
});

function credentials(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (email === undefined || password === undefined) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through /login');
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

test('signed-in user sees the Items page heading read "Your items"', async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  // Wrap playwright page with Skyramp page
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = credentials();

  await test.step('sign in through /login', async () => {
    await signIn(page, email, password);
    await expect(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step('the only level-1 heading reads exactly "Your items"', async () => {
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Your items', { useInnerText: true });
    await expect(page.getByRole('heading', { level: 1, name: 'Items', exact: true })).toHaveCount(0);
  });
});

test('journey: sign in, see my items page and add an item', async ({ page, request }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(pageTimeout);
  // Wrap playwright page with Skyramp page
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = credentials();
  const itemName = `Journey item ${Date.now()}`;
  // Expected request payloads for network assertions
  const expectedPayload1 = { name: itemName };
  let countBefore = 0;

  await test.step('1. sign in through /login and land on /items', async () => {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(`${baseUrl}/items`);
    await expect(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step('2. the Items page shows "Your items" as its only level-1 heading', async () => {
    await expect.soft(page.getByRole('heading', { name: 'Your items', exact: true })).toBeVisible();
    await expect.soft(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect.soft(page.getByRole('heading', { name: 'Items', exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
    const apiItems = await (await request.get(`${baseUrl}/api/items`)).json();
    countBefore = apiItems.length;
    await expect(page.getByTestId('item')).toHaveCount(countBefore);
  });

  await test.step('3. add a new item', async () => {
    const playwrightRequest0: Record<string, any> = { name: itemName };
    await page.getByLabel('New item').fill(getValue(playwrightRequest0, 'name'));
    const responsePromise0 = page.waitForResponse(
      (r) => r.url().endsWith('/api/items') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Add item' }).click();
    const response0 = await responsePromise0;
    // Validate request payload
    checkRequestPayload(response0.request().postDataJSON(), expectedPayload1);
    expect.soft(response0.status()).toBe(201);
    await expect.soft(page.getByTestId('items-list').getByTestId('item').filter({ hasText: itemName })).toHaveText(itemName);
    await expect.soft(page.getByTestId('item')).toHaveCount(countBefore + 1);
    // The order of the list is what this checks: every item in id order, the new one (highest id) last.
    const namesAfterAdd: Array<{ id: number; name: string }> = await (await request.get(`${baseUrl}/api/items`)).json();
    const orderedAfterAdd = [...namesAfterAdd].sort((a, b) => a.id - b.id).map((i) => i.name);
    expect.soft(orderedAfterAdd[orderedAfterAdd.length - 1]).toBe(itemName);
    await expect.soft(page.getByTestId('items-list').getByTestId('item')).toHaveText(orderedAfterAdd);
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
    await expect.soft(page.getByLabel('New item')).toHaveValue('');
  });

  await test.step('4. reload /items: heading and new item persist', async () => {
    await page.reload();
    await expect(page).toHaveTitle('Items - E2E PR App');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect.soft(page.getByRole('heading', { name: 'Your items', exact: true })).toBeVisible();
    await expect.soft(h1).toHaveCount(1);
    await expect.soft(h1).toHaveText('Your items', { useInnerText: true });
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
    await expect.soft(page.getByTestId('item')).toHaveCount(countBefore + 1);
    await expect.soft(page.getByTestId('items-list').getByTestId('item').filter({ hasText: itemName })).toHaveText(itemName);
    // Every item, in id order, as the API returns it (ORDER BY id).
    const apiItems: Array<{ id: number; name: string }> = await (await request.get(`${baseUrl}/api/items`)).json();
    const sorted = [...apiItems].sort((a, b) => a.id - b.id).map((i) => i.name);
    expect(sorted[sorted.length - 1]).toBe(itemName);
    await expect(page.getByTestId('item')).toHaveText(sorted);
  });
});
