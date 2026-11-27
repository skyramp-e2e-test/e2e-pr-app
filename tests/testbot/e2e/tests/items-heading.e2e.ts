// Items page heading: the page's main heading reads "All items" (no longer "Items").
// Drafted with the Skyramp walk helper, then strengthened to check each step and the whole expected outcome.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const pageTimeout = 15000;
const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

test.use({ viewport: { width: 1280, height: 900 } });

function loginCredentials(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through the login page');
  }
  return { email, password };
}

// From the home page, follow the Login nav link and sign in; the app lands the user on /items.
async function signInFromHome(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${baseUrl}/`);
  await page.getByTestId('nav-login').click();
  await expect(page).toHaveURL(`${baseUrl}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
}

// The page has exactly one level-1 heading, it reads exactly "All items", and no heading reads just "Items".
async function expectAllItemsHeading(page: Page): Promise<void> {
  await expect.soft(page.getByRole('heading', { name: 'All items', exact: true })).toBeVisible();
  await expect.soft(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect.soft(page.getByRole('heading', { level: 1 })).toHaveText('All items');
  await expect.soft(page.getByRole('heading', { name: 'Items', exact: true })).toHaveCount(0);
}

test.describe('Items page heading', () => {
  test('signed-in user lands on /items and sees the heading "All items"', async ({ page }) => {
    test.setTimeout(60000);
    page.setDefaultTimeout(pageTimeout);
    page = newSkyrampPlaywrightPage(page);
    const { email, password } = loginCredentials();

    await test.step('sign in from the home page', async () => {
      await signInFromHome(page, email, password);
    });
    await test.step('the Items page heading reads "All items"', async () => {
      await expectAllItemsHeading(page);
      // The nav link "Items" stays a link, not a heading.
      await expect.soft(page.getByTestId('nav-items')).toHaveText('Items');
    });
  });

  test('signed-out visitor opening /items sees the heading "All items"', async ({ page }) => {
    test.setTimeout(60000);
    page.setDefaultTimeout(pageTimeout);
    page = newSkyrampPlaywrightPage(page);

    await test.step('open /items without signing in', async () => {
      await page.goto(`${baseUrl}/items`);
    });
    await test.step('the heading reads "All items" and the status says not signed in', async () => {
      await expectAllItemsHeading(page);
      await expect.soft(page.getByTestId('user-status')).toHaveText('You are not signed in.');
    });
  });

  test('user signs in, sees "All items", adds an item and it is still listed after reload', async ({ page }) => {
    test.setTimeout(90000);
    page.setDefaultTimeout(pageTimeout);
    page = newSkyrampPlaywrightPage(page);
    const { email, password } = loginCredentials();
    // Items are shared and the app has no delete route, so the item's name is unique to this run.
    const itemName = `Heading journey ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const list = page.getByTestId('items-list');

    await test.step('1. open / and click the Login nav link', async () => {
      await page.goto(`${baseUrl}/`);
      await page.getByTestId('nav-login').click();
      await expect(page).toHaveURL(`${baseUrl}/login`);
    });
    await test.step('2. sign in and land on /items', async () => {
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await expect(page).toHaveURL(`${baseUrl}/items`);
    });
    await test.step('3. the page heading reads "All items" and the user is signed in', async () => {
      await expectAllItemsHeading(page);
      await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
    });
    await test.step('4. add an item; it appears in the list and the input is cleared', async () => {
      await page.getByLabel('New item').fill(itemName);
      const responsePromise = page.waitForResponse(
        (res) => res.url().endsWith('/api/items') && res.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Add item' }).click();
      const response = await responsePromise;
      checkRequestPayload(response.request().postDataJSON(), { name: itemName });
      await expect.soft(list.getByText(itemName, { exact: true })).toBeVisible();
      await expect.soft(page.getByLabel('New item')).toHaveValue('');
      await expect.soft(page.getByTestId('item-error')).toBeHidden();
    });
    await test.step('5. reload /items: heading, sign-in status and the new item persist', async () => {
      await page.reload();
      await expect(page).toHaveURL(`${baseUrl}/items`);
      await expectAllItemsHeading(page);
      await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
      await expect.soft(list.getByText(itemName, { exact: true })).toHaveCount(1);
      // The list is ordered by id, so the item this test just added is the last entry.
      await expect
        .soft
        .poll(async () => (await list.getByTestId('item').allTextContents()).at(-1))
        .toBe(itemName);
      await expect.soft(page.getByTestId('item-error')).toBeHidden();
      await expect.soft(page.getByLabel('New item')).toHaveValue('');
    });
  });
});
