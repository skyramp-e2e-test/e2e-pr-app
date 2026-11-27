// Items page heading: the page at /items shows the level-1 heading "Your items", not "Items",
// for signed-in and anonymous visitors, and through a sign-in and add-item journey.
// Drafted from Skyramp walk recordings, then strengthened by hand.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";

const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");
const pageTimeout = 15000;

function loginFromEnv(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in as the seeded test user");
  }
  return { email, password };
}

function wrap(page: Page): Page {
  page.setDefaultTimeout(pageTimeout);
  return newSkyrampPlaywrightPage(page);
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${baseUrl}/items`);
}

test.use({ viewport: { width: 1280, height: 900 } });

test("signed-in user sees the heading Your items on the Items page", async ({ page }) => {
  test.setTimeout(60000);
  page = wrap(page);
  const { email, password } = loginFromEnv();

  await signIn(page, email, password);

  await expect(page).toHaveURL(`${baseUrl}/items`);
  await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your items");
  await expect(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
  // The nav link keeps its own name.
  await expect(page.getByRole("link", { name: "Items", exact: true })).toBeVisible();
});

test("anonymous visitor who follows the Items nav link sees the heading Your items", async ({ page }) => {
  test.setTimeout(60000);
  page = wrap(page);
  await page.context().clearCookies();

  await page.goto(`${baseUrl}/`);
  await page.getByTestId("nav-items").click();
  await page.waitForURL(`${baseUrl}/items`);

  await expect(page.getByTestId("user-status")).toHaveText("You are not signed in.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your items");
  await expect(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
});

test("signed-in user adds an item on the Your items page and it stays after a reload", async ({ page }) => {
  test.setTimeout(90000);
  page = wrap(page);
  const { email, password } = loginFromEnv();
  const itemName = `Walk item ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const heading = page.getByRole("heading", { level: 1 });
  const items = page.getByTestId("item");
  let before: string[] = [];

  await test.step("1. sign in through /login and land on /items", async () => {
    await signIn(page, email, password);
    await expect.soft(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step("2. the Items page shows the heading Your items and the signed-in status", async () => {
    await expect.soft(heading).toHaveCount(1);
    await expect.soft(page.getByRole("heading", { name: "Your items", exact: true })).toBeVisible();
    await expect.soft(heading).toHaveText("Your items");
    await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  });

  await test.step("3. add a new item", async () => {
    const res = await page.request.get(`${baseUrl}/api/items`);
    before = ((await res.json()) as Array<{ name: string }>).map((i) => i.name);
    await expect(items).toHaveCount(before.length);

    await page.getByLabel("New item").fill(itemName);
    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith("/api/items") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Add item" }).click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect.soft(response.status()).toBe(201);

    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    // The list is ordered by id: every earlier item, then the new one at the end.
    await expect.soft(items.filter({ hasText: itemName })).toHaveCount(1);
    await expect.soft(items).toHaveText([...before, itemName]);
  });

  await test.step("4. reload: heading, item and status persist", async () => {
    await page.reload();
    await expect.soft(heading).toHaveCount(1);
    await expect.soft(heading).toHaveText("Your items");
    await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expect.soft(items.filter({ hasText: itemName })).toHaveCount(1);
    await expect.soft(items).toHaveText([...before, itemName]);
  });
});
