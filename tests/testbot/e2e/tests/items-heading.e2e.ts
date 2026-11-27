// Browser tests for the Items page heading (/items), recorded with the Skyramp walk helper and fitted here.
// The app has no endpoint to delete an item, so the items these tests add (named "Walk item <run>-<n>") stay in it.
import { test, expect, type Page } from "@playwright/test";
import { checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";

const baseUrl = process.env.SKYRAMP_TEST_BASE_URL || "http://localhost:3000";
const runId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let itemSeq = 0;
const uniqueItemName = () => `Walk item ${runId}-${++itemSeq}`;

function credentials() {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through the login form");
  }
  return { email, password };
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
  await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
}

async function addItem(page: Page, name: string) {
  await page.getByLabel("New item").fill(name);
  const responsePromise = page.waitForResponse(
    (r) => r.url() === `${baseUrl}/api/items` && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Add item" }).click();
  const response = await responsePromise;
  checkRequestPayload(response.request().postDataJSON(), { name });
  return response;
}

test.use({ viewport: { width: 1280, height: 900 } });

test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15000);
});

test("signed-in user sees the Items page headed Your items", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = credentials();
  await signIn(page, email, password);

  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText("Your items");
  await expect(page.getByTestId("items-heading")).toHaveText("Your items");
});

test("Items heading still reads Your items after adding an item and reloading", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = credentials();
  const name = uniqueItemName();
  await signIn(page, email, password);

  const response = await addItem(page, name);
  expect(response.status()).toBe(201);
  await expect(page.getByTestId("items-list").getByTestId("item").filter({ hasText: name })).toHaveText(name);

  await page.reload();
  await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText("Your items");
});

test("sign in and add an item on my Items page", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = credentials();
  const name = uniqueItemName();
  const h1 = page.getByRole("heading", { level: 1 });
  const items = page.getByTestId("items-list").getByTestId("item");
  const added = items.filter({ hasText: name });

  await test.step("1. sign in through the login form", async () => {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step("2. view the Items page", async () => {
    await expect.soft(h1).toHaveCount(1);
    await expect.soft(h1).toHaveText("Your items");
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    await expect.soft(added).toHaveCount(0);
  });

  await test.step("3. add an item", async () => {
    const response = await addItem(page, name);
    expect.soft(response.status()).toBe(201);
    await expect.soft(added).toHaveCount(1);
    await expect.soft(added).toHaveText(name);
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expect.soft(h1).toHaveText("Your items");
  });

  await test.step("4. reload the Items page", async () => {
    await page.reload();
    await expect.soft(page).toHaveTitle("Items - E2E PR App");
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    await expect.soft(h1).toHaveCount(1);
    await expect.soft(h1).toHaveText("Your items");
    await expect.soft(h1).not.toHaveText("My items");
    const nav = page.getByRole("navigation");
    await expect.soft(nav.getByRole("link", { name: "Home" })).toBeVisible();
    await expect.soft(nav.getByRole("link", { name: "Login" })).toBeVisible();
    await expect.soft(nav.getByRole("link", { name: "Items" })).toBeVisible();
    await expect.soft(nav.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expect.soft(added).toHaveCount(1);
    await expect.soft(added).toHaveText(name);
    // The list is ordered by id, so the item this test just added is the last one.
    await expect.soft.poll(async () => (await items.allTextContents()).at(-1)).toBe(name);
  });
});
