// Drafted with the Skyramp walk helper, then fitted to this package.
import { test, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';

const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

test('Items page heading reads "Your items" after sign-in', async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(15000);
  page = newSkyrampPlaywrightPage(page);

  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error('SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: this test signs in');
  }

  await page.goto(`${baseUrl}/login`);
  await page.getByLabel('Email').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);

  const heading = page.getByTestId('items-heading');
  await expect(heading).toHaveText('Your items');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your items');
  await expect(page.getByRole('heading', { name: 'Items', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('user-status')).toHaveText(`Signed in as ${username}`);
});
