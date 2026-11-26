// Browser tests for the Items page heading ("Your items") and the sign-in-and-add-an-item journey through it.
// Drafted with the Skyramp walk helper, then strengthened by hand.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const pageTimeout = 15000;
const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');
const HEADING = 'Your items';

test.use({ viewport: { width: 1280, height: 900 } });

function credentials(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through /login');
  }
  return { email, password };
}

// Signs in through the login form; resolves once /items has loaded its item list.
async function signIn(page: Page): Promise<string[]> {
  const { email, password } = credentials();
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  const itemsLoaded = page.waitForResponse(
    (res) => res.url().endsWith('/api/items') && res.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Sign in' }).click();
  const res = await itemsLoaded;
  await expect(page).toHaveURL(`${baseUrl}/items`);
  const items = (await res.json()) as { name: string }[];
  await expect(page.getByTestId('item')).toHaveCount(items.length);
  return items.map((item) => item.name);
}

async function expectSingleYourItemsHeading(page: Page) {
  const h1 = page.getByRole('heading', { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText(HEADING);
  await expect(page.getByRole('heading', { name: 'Items', exact: true })).toHaveCount(0);
}

test.describe('Items page heading', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(pageTimeout);
  });

  test('signed-in user sees a single h1 reading "Your items", also after reload', async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await signIn(page);
    await expectSingleYourItemsHeading(page);
    await page.reload();
    await expectSingleYourItemsHeading(page);
  });

  test('heading is the h1 found by test id items-heading', async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await signIn(page);
    const heading = page.getByTestId('items-heading');
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveJSProperty('tagName', 'H1');
    await expect(heading).toHaveText(HEADING);
  });

  test('signed-out visitor sees "Your items" and the not-signed-in status', async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await page.goto(`${baseUrl}/items`);
    await expectSingleYourItemsHeading(page);
    await expect(page.getByTestId('items-heading')).toHaveText(HEADING);
    await expect(page.getByTestId('user-status')).toHaveText('You are not signed in.');
  });
});

test('sign in, land on my items page under its new heading, and add an item', async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { email } = credentials();
  const name = `Journey item ${Date.now()}`;
  let before: string[] = [];

  await test.step('1. sign in at /login and land on /items', async () => {
    before = await signIn(page);
  });

  await test.step('2. see the page heading and status', async () => {
    const h1 = page.getByRole('heading', { level: 1 });
    await expect.soft(h1).toHaveCount(1);
    await expect.soft(h1).toHaveText(HEADING);
    await expect.soft(page.getByTestId('items-heading')).toHaveText(HEADING);
    await expect.soft(page.getByRole('heading', { name: 'Items', exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
    await expect.soft(page).toHaveTitle('Items - E2E PR App');
  });

  await test.step('3. add an item', async () => {
    await page.getByLabel('New item').fill(name);
    const responsePromise = page.waitForResponse(
      (res) => res.url().endsWith('/api/items') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Add item' }).click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name });
    expect.soft(response.status()).toBe(201);
    await expect.soft(page.getByTestId('item')).toHaveText([...before, name]);
    await expect.soft(page.getByLabel('New item')).toHaveValue('');
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
  });

  await test.step('4. reload /items', async () => {
    await page.reload();
    const h1 = page.getByRole('heading', { level: 1 });
    await expect.soft(h1).toHaveCount(1);
    await expect.soft(h1).toHaveText(HEADING);
    await expect.soft(page.getByTestId('items-heading')).toHaveText(HEADING);
    await expect.soft(page.getByRole('heading', { name: 'Items', exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
    await expect.soft(page.getByTestId('item')).toHaveText([...before, name]);
    await expect.soft(page.getByLabel('New item')).toHaveValue('');
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
  });
});
