// Drafted with the Skyramp walk helper, then fitted to this package.
import { test, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const baseUrl = getBaseUrl('SKYRAMP_TEST_SERVICE_URL_APP', process.env.SKYRAMP_TEST_BASE_URL || 'http://localhost:3000');

function credentials() {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in');
  }
  return { email, password };
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
}

test.use({ viewport: { width: 1280, height: 900 } });

test('signed-in Items page is headed Your items', async ({ page, request }) => {
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = credentials();

  await test.step('sign in and land on /items', async () => {
    await signIn(page, email, password);
    await expect(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
  });

  await test.step('the single level-1 heading reads Your items', async () => {
    const headings = page.getByRole('heading', { level: 1 });
    await expect.soft(headings).toHaveCount(1);
    await expect.soft(headings).toHaveText('Your items');
    await expect.soft(page.getByTestId('items-heading')).toHaveText('Your items');
  });

  await test.step('GET /items serves an <h1> reading Your items', async () => {
    const res = await request.get(`${baseUrl}/items`);
    expect.soft(res.status()).toBe(200);
    const h1s = [...(await res.text()).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].trim());
    expect.soft(h1s).toEqual(['Your items']);
  });
});

test('sign in, land on Your items, add an item and see it after reload', async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = credentials();
  const itemName = `Journey item ${Date.now()}`;
  const heading = page.getByRole('heading', { level: 1 });
  const status = page.getByTestId('user-status');
  const items = page.getByTestId('items-list').getByTestId('item');
  const addedItem = items.filter({ hasText: itemName });
  // The list is ordered by creation, so the order is what this checks: the added item comes last.
  const lastItemText = async () => (await items.allTextContents()).at(-1);

  await test.step('1. sign in at /login and land on /items', async () => {
    await signIn(page, email, password);
  });

  await test.step('2. /items shows heading Your items and the signed-in status', async () => {
    await expect(status).toHaveText(`Signed in as ${email}`);
    await expect.soft(heading).toHaveText('Your items');
  });

  await test.step('3. add an item through the form', async () => {
    await page.getByLabel('New item').fill(itemName);
    await page.getByRole('button', { name: 'Add item' }).click();
    await expect(page.getByLabel('New item')).toHaveValue('');
    await expect(page.getByTestId('item-error')).toBeHidden();
    await expect(addedItem).toHaveText(itemName);
    await expect.poll(lastItemText).toBe(itemName);
  });

  await test.step('4. after reload the heading, status and new item persist', async () => {
    await page.reload();
    await expect(status).toHaveText(`Signed in as ${email}`);
    await expect.soft(heading).toHaveText('Your items');
    await expect(addedItem).toHaveText(itemName);
    await expect.poll(lastItemText).toBe(itemName);
    await expect(page.getByTestId('item-error')).toBeHidden();
    await expect(page.getByLabel('New item')).toHaveValue('');
  });
});
