// A signed-in user lands on the Items page headed "Your items", and the rest of the page keeps working.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";

const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

function credentials(): { username: string; password: string } {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through the login page");
  }
  return { username, password };
}

// Signs in through /login and checks the POST /login answer redirects (303) to /items.
async function signIn(page: Page, username: string, password: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill(username);
  await page.getByLabel("Password").fill(password);
  const loginResponse = page.waitForResponse(
    (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/login",
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  const response = await loginResponse;
  expect.soft(response.status()).toBe(303);
  expect.soft(response.headers()["location"]).toBe("/items");
  await expect(page).toHaveURL(`${baseUrl}/items`);
}

async function expectHeadedYourItems(page: Page): Promise<void> {
  await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
  await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText("Your items");
  await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
}

test("signing in lands on the items page headed Your items with status, add form and list", async ({ page }) => {
  page.setDefaultTimeout(15000);
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = credentials();

  await test.step("sign in and land on /items", async () => {
    await signIn(page, username, password);
  });

  await test.step("the page is headed Your items and its other content is there", async () => {
    await expectHeadedYourItems(page);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
    await expect.soft(page.getByLabel("New item")).toBeVisible();
    await expect.soft(page.getByRole("button", { name: "Add item" })).toBeVisible();
    await expect.soft(page.getByTestId("items-list")).toBeAttached();
  });
});

test("sign in, see the items page headed Your items, and add an item", async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(15000);
  page = newSkyrampPlaywrightPage(page);
  const { username, password } = credentials();
  const itemName = `Heading walk item ${Date.now()}`;
  let earlierItems: string[] = [];

  await test.step("1. sign in from /login and land on /items", async () => {
    await signIn(page, username, password);
  });

  await test.step("2. the items page is headed Your items and shows who is signed in", async () => {
    await expectHeadedYourItems(page);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
    // The page loads the list after it renders: wait for that load before reading the rows.
    await page.waitForLoadState("networkidle");
    earlierItems = await page.getByTestId("item").allTextContents();
  });

  await test.step("3. add an item through the form", async () => {
    await page.getByLabel("New item").fill(itemName);
    const addResponse = page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/items",
    );
    await page.getByRole("button", { name: "Add item" }).click();
    const response = await addResponse;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect.soft(response.status()).toBe(201);
    expect.soft((await response.json()).name).toBe(itemName);
    await expect.soft(page.getByTestId("item").filter({ hasText: itemName })).toHaveText([itemName]);
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expectHeadedYourItems(page);
  });

  await test.step("4. after a reload the page keeps its heading, status and the new item", async () => {
    await page.reload();
    await expectHeadedYourItems(page);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
    await expect.soft(page.getByTestId("item").filter({ hasText: itemName })).toHaveText([itemName]);
    // Other tests may add items at the same time: check the rows seen before are all still there,
    // rather than the length of the shared list.
    await expect
      .poll(async () => {
        const now = await page.getByTestId("item").allTextContents();
        return earlierItems.every((name) => now.includes(name));
      })
      .toBe(true);
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
  });
});
