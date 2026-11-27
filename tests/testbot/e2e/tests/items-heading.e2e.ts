// Items page heading ("Your items") and the rest of the Items page around it.
// Drafted with the Skyramp walk helper, then extended to check every part of each case.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const pageTimeout = 15000;

// URL for test requests
const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

test.use({
  viewport: { width: 1280, height: 900 },
});

function loginCredentials(): { username: string; password: string } {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (username === undefined || password === undefined) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through /login');
  }
  return { username, password };
}

// Signs in through the /login form, which redirects to /items.
async function signIn(page: Page, username: string, password: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('Email').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
}

// Adds an item through the form and checks the POST /api/items request body.
async function addItem(page: Page, name: string): Promise<void> {
  await page.getByLabel('New item').fill(name);
  const responsePromise = page.waitForResponse(
    (r) => r.url() === `${baseUrl}/api/items` && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Add item' }).click();
  const response = await responsePromise;
  // Validate request payload
  checkRequestPayload(response.request().postDataJSON(), { name });
}

test.describe('Items page heading', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(pageTimeout);
  });

  test('signed-in user sees the Items page headed "Your items" as its only h1', async ({ page }) => {
    // Wrap playwright page with Skyramp page
    page = newSkyrampPlaywrightPage(page);
    const { username, password } = loginCredentials();

    await signIn(page, username, password);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your items');
    await expect(page.getByTestId('items-heading')).toHaveText('Your items');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Items', exact: true })).toHaveCount(0);
  });

  test('signed-out visitor sees the Items page headed "Your items"', async ({ page }) => {
    // Wrap playwright page with Skyramp page
    page = newSkyrampPlaywrightPage(page);

    await page.goto(`${baseUrl}/items`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your items');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByTestId('user-status')).toHaveText('You are not signed in.');
  });

  test('signed-in user still sees the status line and can add an item that stays after reload', async ({ page }) => {
    // Wrap playwright page with Skyramp page
    page = newSkyrampPlaywrightPage(page);
    const { username, password } = loginCredentials();
    const name = `Heading check item ${Date.now()}`;

    await signIn(page, username, password);
    await expect(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);

    await addItem(page, name);
    // The list is ordered by id, so the item just added is the last entry.
    await expect(page.getByTestId('items-list').getByTestId('item').last()).toHaveText(name);
    await expect(page.getByLabel('New item')).toHaveValue('');
    await expect(page.getByTestId('item-error')).toBeHidden();

    await page.goto(`${baseUrl}/items`);
    await expect(page.getByTestId('items-list').getByTestId('item').filter({ hasText: name })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your items');
  });

  test('journey: sign in, see my items page headed Your items, and add an item', async ({ page }) => {
    // Wrap playwright page with Skyramp page
    page = newSkyrampPlaywrightPage(page);
    const { username, password } = loginCredentials();
    const name = `Journey item ${Date.now()}`;

    await test.step('1. sign in through /login and land on /items', async () => {
      await page.goto(`${baseUrl}/login`);
      await page.getByLabel('Email').fill(username);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page).toHaveURL(`${baseUrl}/items`);
    });

    await test.step('2. the page is headed "Your items" and shows the signed-in status', async () => {
      await expect.soft(page.getByTestId('items-heading')).toHaveText('Your items');
      await expect.soft(page.getByRole('heading', { name: 'Your items', exact: true, level: 1 })).toBeVisible();
      await expect.soft(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);
    });

    await test.step('3. add an item; it is the last entry, the field is empty and no error shows', async () => {
      await addItem(page, name);
      // Position is what this checks: the list is ordered by id, so the item just added is the last entry.
      await expect.soft(page.getByTestId('items-list').getByTestId('item').last()).toHaveText(name);
      await expect.soft(page.getByLabel('New item')).toHaveValue('');
      await expect.soft(page.getByTestId('item-error')).toBeHidden();
    });

    await test.step('4. after a reload the heading, item and status are unchanged', async () => {
      await page.reload();
      await expect.soft(page.getByTestId('items-heading')).toHaveText('Your items');
      await expect.soft(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect.soft(page.getByTestId('items-list').getByTestId('item').filter({ hasText: name })).toHaveCount(1);
      // Position is what this checks: the added item is still the last entry.
      await expect.soft(page.getByTestId('items-list').getByTestId('item').last()).toHaveText(name);
      await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);
      await expect.soft(page.getByLabel('New item')).toHaveValue('');
      await expect.soft(page.getByTestId('item-error')).toBeHidden();
    });
  });
});
