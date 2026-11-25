import { test, expect, type Page } from "@playwright/test";
import { checkRequestPayload, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";

// The Items page (public/items.html) and what a signed-in user sees on it.
const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

function credentials(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in");
  }
  return { email, password };
}

function uniqueItemName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${baseUrl}/items`);
}

async function expectYourItemsHeading(page: Page): Promise<void> {
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText("Your items", { useInnerText: true });
  await expect(page.getByRole("heading", { level: 1, name: "Items", exact: true })).toHaveCount(0);
}

async function addItem(page: Page, name: string): Promise<void> {
  await page.getByLabel("New item").fill(name);
  const responsePromise = page.waitForResponse(
    (r) => r.url() === `${baseUrl}/api/items` && r.request().method() === "POST",
  );
  const reloaded = page.waitForResponse(
    (r) => r.url() === `${baseUrl}/api/items` && r.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Add item" }).click();
  const response = await responsePromise;
  checkRequestPayload(response.request().postDataJSON(), { name });
  expect(response.status()).toBe(201);
  await reloaded;
}

async function expectAddedItemLast(page: Page, name: string): Promise<void> {
  // The list shows items in creation order, so the one just added must be the last entry.
  const list = page.getByTestId("items-list");
  await expect.soft(list.getByTestId("item").filter({ hasText: name })).toHaveText([name]);
  const names = await list.getByTestId("item").allTextContents();
  expect.soft(names[names.length - 1]).toBe(name);
}

test.use({ viewport: { width: 1280, height: 900 } });

test("signed-in user sees the Items page heading reading Your items", async ({ page: pwPage }) => {
  const page = newSkyrampPlaywrightPage(pwPage);
  const { email, password } = credentials();

  await signIn(page, email, password);
  await expect(page).toHaveURL(`${baseUrl}/items`);
  await expectYourItemsHeading(page);
});

test("Your items heading stays after adding an item and reloading", async ({ page: pwPage }) => {
  const page = newSkyrampPlaywrightPage(pwPage);
  const { email, password } = credentials();
  const name = uniqueItemName("Heading item");

  await signIn(page, email, password);
  await addItem(page, name);
  await expectAddedItemLast(page, name);
  await expectYourItemsHeading(page);

  await page.goto(`${baseUrl}/items`);
  await expectAddedItemLast(page, name);
  await expectYourItemsHeading(page);
});

test("user signs in, adds an item on the Your items page and sees it after a reload", async ({ page: pwPage }) => {
  const page = newSkyrampPlaywrightPage(pwPage);
  const { email, password } = credentials();
  const name = uniqueItemName("Journey item");
  const heading = page.getByRole("heading", { name: "Your items", exact: true });

  await test.step("1. sign in at /login and land on /items", async () => {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step("2. /items shows the Your items heading and the sign-in status", async () => {
    await expect.soft(heading).toBeVisible();
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText("Your items", { useInnerText: true });
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  });

  await test.step("3. add an item with a unique name", async () => {
    await addItem(page, name);
    await expectAddedItemLast(page, name);
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expect.soft(heading).toBeVisible();
  });

  await test.step("4. reload /items and see the added item still listed", async () => {
    await page.reload();
    await expect(page).toHaveURL(`${baseUrl}/items`);
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText("Your items", { useInnerText: true });
    await expect.soft(heading).toBeVisible();
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expectAddedItemLast(page, name);
  });
});
