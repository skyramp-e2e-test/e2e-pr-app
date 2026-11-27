// Drafted from Skyramp walks of the Items page (skyramp generate ui rest), then fitted to this package.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const pageTimeout = 15000;

// URL for test requests
const baseUrl = getBaseUrl('SKYRAMP_TEST_SERVICE_URL_APP', 'http://localhost:3000');

test.use({
  viewport: { width: 1280, height: 900 },
});

// The sign-in account comes from the environment, never from this file.
function loginCredentials(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (email === undefined || password === undefined) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through /login');
  }
  return { email, password };
}

async function signIn(page: Page): Promise<string> {
  const { email, password } = loginCredentials();
  await page.goto(`${baseUrl}/login`);
  await page.getByTestId('email-input').fill(email);
  await page.getByTestId('password-input').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
  return email;
}

test('the Items page is headed "Your items" and no longer "Items"', async ({ page }) => {
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);

  await signIn(page);

  await expect(page.getByRole('heading', { name: 'Your items', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your items');
  await expect(page.getByRole('heading', { name: 'Items', exact: true })).toHaveCount(0);
});

test('the Items page heading carries the test id items-heading', async ({ page }) => {
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);

  await signIn(page);

  const heading = page.getByTestId('items-heading');
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText('Your items');
  await expect(heading).toHaveJSProperty('tagName', 'H1');
});

test('sign in, see the Your items heading and add an item that stays after a reload', async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);

  const itemName = `Journey item ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  let email = '';

  await test.step('1. sign in at /login and land on /items', async () => {
    email = await signIn(page);
  });

  await test.step('2. the page is headed "Your items"', async () => {
    await expect.soft(page.getByRole('heading', { name: 'Your items', exact: true })).toBeVisible();
    await expect.soft(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect.soft(page.getByRole('heading', { level: 1 })).toHaveText('Your items');
    await expect.soft(page.getByTestId('items-heading')).toHaveText('Your items');
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
  });

  await test.step('3. add an item', async () => {
    const expectedPayload = { name: itemName };
    await page.getByLabel('New item').fill(itemName);
    const responsePromise = page.waitForResponse(
      (res) => res.url().endsWith('/api/items') && res.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Add item' }).click();
    const response = await responsePromise;
    // Validate request payload
    checkRequestPayload(response.request().postDataJSON(), expectedPayload);
    expect.soft(response.status()).toBe(201);

    // The list is in insertion order: the new item is the last entry.
    await expect.soft(page.getByTestId('item').last()).toHaveText(itemName);
    await expect.soft(page.getByLabel('New item')).toHaveValue('');
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
  });

  await test.step('4. reload /items: heading and the added item are still there', async () => {
    await page.reload();
    await expect(page.getByTestId('items-heading')).toHaveText('Your items');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your items');
    await expect(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
    await expect(page.getByTestId('item').last()).toHaveText(itemName); // the order is what this checks: the new item is last
    await expect(page.getByTestId('items-list').getByText(itemName, { exact: true })).toHaveCount(1);
    await expect(page.getByLabel('New item')).toHaveValue('');
    await expect(page.getByTestId('item-error')).toBeHidden();
  });
});
