// Items page heading: the page at /items is headed "Your items" for every visitor,
// and a signed-in user can still add items under it.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const pageTimeout = 15000;

const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

function credentials(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through /login');
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

// The page's one level-1 heading reads exactly "Your items", is the element tagged
// items-heading, and the old "Items" heading is gone.
async function expectYourItemsHeading(page: Page): Promise<void> {
  const h1 = page.getByRole('heading', { level: 1 });
  await expect.soft(h1).toHaveCount(1);
  await expect.soft(h1).toHaveText('Your items');
  await expect.soft(h1).toHaveAttribute('data-testid', 'items-heading');
  await expect.soft(page.getByTestId('items-heading')).toHaveText('Your items');
  await expect.soft(page.getByTestId('items-heading')).toHaveJSProperty('tagName', 'H1');
  await expect.soft(page.getByRole('heading', { name: 'Items', exact: true })).toHaveCount(0);
}

test.use({
  viewport: { width: 1280, height: 900 },
});

test('a signed-in user sees the Items page headed "Your items"', async ({ page }) => {
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = credentials();

  await test.step('sign in at /login and land on /items', async () => {
    await signIn(page, email, password);
    await expect(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
  });

  await test.step('the single h1 reads exactly "Your items"', async () => {
    await expectYourItemsHeading(page);
  });
});

test('a visitor who is not signed in sees the same "Your items" heading', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    let page = await context.newPage();
    page.setDefaultTimeout(pageTimeout);
    page = newSkyrampPlaywrightPage(page);
    expect(await context.cookies()).toEqual([]);

    await test.step('open /items with no session', async () => {
      await page.goto(`${baseUrl}/items`);
      await expect.soft(page.getByTestId('user-status')).toHaveText('You are not signed in.');
    });

    await test.step('the single h1 reads exactly "Your items"', async () => {
      await expectYourItemsHeading(page);
    });
  } finally {
    await context.close();
  }
});

test('journey: sign in, see "Your items", add an item and find it after a reload', async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = credentials();
  const itemName = `J1 item ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const list = page.getByTestId('items-list');
  const items = list.getByTestId('item');
  let before: string[] = [];

  await test.step('1. /login: sign in and land on /items', async () => {
    await signIn(page, email, password);
  });

  await test.step('2. /items: the heading reads "Your items" and the user is signed in', async () => {
    await expectYourItemsHeading(page);
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
    // The list is filled by GET /api/items after load; read it once that has answered.
    await page.waitForLoadState('networkidle');
    before = await items.allTextContents();
  });

  await test.step('3. /items: add an item', async () => {
    const input = page.getByLabel('New item');
    await input.fill(itemName);
    const posted = page.waitForResponse(
      (r) => r.url() === `${baseUrl}/api/items` && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Add item' }).click();
    const response = await posted;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    await expect.soft(input).toHaveValue('');
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
    await expect.soft(items).toHaveText([...before, itemName]);
  });

  await test.step('4. /items: reload; heading, status and the added item persist', async () => {
    await page.reload();
    await expectYourItemsHeading(page);
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${email}`);
    await expect.soft(items).toHaveText([...before, itemName]);
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
  });
});
