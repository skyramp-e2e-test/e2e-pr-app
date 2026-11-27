// Items page heading: the page at /items is headed "Your items", for a signed-in user.
// Drafted with the Skyramp walk helper, then extended to check every step of the journey.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const pageTimeout = 15000;
const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

function credentials(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in as the seeded user');
  }
  return { email, password };
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
}

test.use({ viewport: { width: 1280, height: 900 } });

test('signed-in Items page shows one level-1 heading reading exactly "Your items"', async ({ page }) => {
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = credentials();

  await signIn(page, email, password);
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveText(/^Your items$/);
});

test('sign in, land on Your items, add an item and see it kept after a reload', async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = credentials();
  const itemName = `Journey item ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const heading = page.getByRole('heading', { level: 1 });
  const itemsList = page.getByTestId('items-list');

  await test.step('1. sign in on /login and land on /items', async () => {
    await signIn(page, email, password);
  });

  await test.step('2. the Items page is headed "Your items"', async () => {
    await expect.soft(heading).toHaveCount(1);
    await expect.soft(heading).toHaveText(/^Your items$/);
    await expect.soft(page.getByTestId('items-heading')).toHaveText(/^Your items$/);
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
    const nav = page.getByRole('navigation');
    await expect.soft(nav.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect.soft(nav.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect.soft(nav.getByRole('link', { name: 'Items' })).toBeVisible();
    await expect.soft(nav.getByRole('button', { name: 'Sign out' })).toBeVisible();
  });

  await test.step('3. add an item', async () => {
    const input = page.getByLabel('New item');
    await input.fill(itemName);
    const responsePromise = page.waitForResponse(
      (r) => r.url() === `${baseUrl}/api/items` && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Add item' }).click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect(response.status()).toBe(201);
    expect((await response.json()).name).toBe(itemName);
    await expect(itemsList.getByTestId('item').filter({ hasText: itemName })).toHaveCount(1);
    // The list is ordered by id, so the item just added is the last one the API returns.
    const apiItems: { name: string }[] = await (await page.request.get(`${baseUrl}/api/items`)).json();
    expect(apiItems[apiItems.length - 1].name).toBe(itemName);
    await expect(itemsList.getByTestId('item')).toHaveText(apiItems.map((i) => i.name));
    await expect(input).toHaveValue('');
    await expect(page.getByTestId('item-error')).toBeHidden();
  });

  await test.step('4. reload /items: heading, status and the added item stay', async () => {
    await page.reload();
    await expect.soft(heading).toHaveCount(1);
    await expect.soft(heading).toHaveText(/^Your items$/);
    await expect(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
    const apiItems: { name: string }[] = await (await page.request.get(`${baseUrl}/api/items`)).json();
    await expect(itemsList.getByTestId('item')).toHaveText(apiItems.map((i) => i.name));
    expect(apiItems[apiItems.length - 1].name).toBe(itemName);
    await expect(itemsList.getByTestId('item').filter({ hasText: itemName })).toHaveCount(1);
    await expect(page.getByLabel('New item')).toHaveValue('');
    await expect(page.getByTestId('item-error')).toBeHidden();
  });
});
