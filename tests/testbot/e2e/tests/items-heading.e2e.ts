// Items page heading: the page at /items is headed "Your items" (data-testid="items-heading").
// Drafted with the Skyramp walk helper, then strengthened by hand.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const pageTimeout = 15000;

const baseUrl = getBaseUrl("SKYRAMP_TEST_SERVICE_URL_APP", process.env.SKYRAMP_TEST_BASE_URL || "http://localhost:3000");

test.use({
  viewport: { width: 1280, height: 900 },
});

function credentials(): { username: string; password: string } {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in as the seeded user");
  }
  return { username, password };
}

async function signIn(page: Page, username: string, password: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
}

test('signed-in Items page has exactly one h1, reading "Your items"', async ({ page }) => {
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = credentials();

  await signIn(page, username, password);

  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText("Your items", { useInnerText: true });
  await expect(page.getByRole("heading", { name: "Your items", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
});

test('Items heading carries data-testid="items-heading" on the h1', async ({ page }) => {
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = credentials();

  await signIn(page, username, password);

  const heading = page.getByTestId("items-heading");
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCount(1);
  expect(await heading.evaluate((el) => el.tagName)).toBe("H1");
  await expect(heading).toHaveText("Your items");
});

test('Items page shows "Your items" to a visitor who is not signed in', async ({ page }) => {
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);

  await page.goto(`${baseUrl}/items`);
  const heading = page.getByTestId("items-heading");
  await expect(heading).toHaveText("Your items");
  expect(await heading.evaluate((el) => el.tagName)).toBe("H1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your items");
  await expect(page.getByTestId("user-status")).toHaveText("You are not signed in.");
});

test('sign in, see the Items page headed "Your items", add an item and see it after reload', async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = credentials();
  const itemName = `Journey item ${Date.now()}`;

  await test.step("1. open the home page and go to Login", async () => {
    await page.goto(`${baseUrl}/`);
    await page.getByTestId("nav-login").click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toHaveText("Sign in");
  });

  await test.step("2. sign in as the seeded user and land on /items", async () => {
    await page.getByLabel("Email").fill(username);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step("3. the page heading reads Your items", async () => {
    await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
    await expect.soft(page.getByRole("heading", { name: "Your items", exact: true })).toBeVisible();
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
  });

  await test.step("4. add an item", async () => {
    const input = page.getByLabel("New item");
    await input.fill(itemName);
    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith("/api/items") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Add item" }).click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect.soft(response.status()).toBe(201);
    const addedItem = page.getByTestId("items-list").getByText(itemName, { exact: true });
    await expect.soft(addedItem).toHaveCount(1);
    await expect.soft(addedItem).toBeVisible();
    await expect.soft(input).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
  });

  await test.step("5. reload the page: heading and item persist", async () => {
    await page.reload();
    await expect.soft(page).toHaveURL(`${baseUrl}/items`);
    await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
    const addedItem = page.getByTestId("items-list").getByText(itemName, { exact: true });
    await expect.soft(addedItem).toHaveCount(1);
    await expect.soft(addedItem).toBeVisible();
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
  });
});
