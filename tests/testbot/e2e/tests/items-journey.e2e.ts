// Drafted with the Skyramp walk helper, then fitted to this package.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';

const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

test('sign in and add an item on the Your items page', async ({ page }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  page = newSkyrampPlaywrightPage(page);

  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: this test signs in');
  }
  const itemName = `Journey item ${Date.now()}`;
  const items = page.getByTestId('item');
  const addedItem = page.getByTestId('items-list').getByText(itemName, { exact: true });
  let before: string[] = [];

  await test.step('1. sign in at /login', async () => {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel('Email').fill(username);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step('2. see the heading and sign-in status on /items', async () => {
    await expect.soft(page.getByTestId('items-heading')).toHaveText('Your items');
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);
  });

  await test.step('3. add an item', async () => {
    const listed = await page.request.get(`${baseUrl}/api/items`);
    expect(listed.status()).toBe(200);
    before = (await listed.json()).map((item: { name: string }) => item.name);
    await expect(items).toHaveCount(before.length);

    await page.getByLabel('New item').fill(itemName);
    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith('/api/items') && r.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Add item' }).click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect.soft(response.status()).toBe(201);

    await expect.soft(page.getByLabel('New item')).toHaveValue('');
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
    await expect.soft(addedItem).toHaveText(itemName);
  });

  await test.step('4. reload /items and see the item persisted', async () => {
    await page.reload();
    await expect.soft(page.getByTestId('items-heading')).toHaveText('Your items');
    await expect.soft(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);
    await expect.soft(addedItem).toHaveText(itemName);
    await expect.soft(items.filter({ hasText: itemName })).toHaveCount(1);
    const after = await items.allTextContents();
    expect.soft(after.slice(0, before.length)).toEqual(before);
    await expect.soft(page.getByTestId('item-error')).toBeHidden();
  });
});
