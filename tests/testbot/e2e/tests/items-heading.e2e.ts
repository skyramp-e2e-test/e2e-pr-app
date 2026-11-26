// Items page heading: the page is headed "Your items", replacing the old "Items" heading,
// while sign-in status, the add form and the list below it keep working.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";

const pageTimeout = 15000;
const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

test.use({ viewport: { width: 1280, height: 900 } });

function credentials(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in");
  }
  return { email, password };
}

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${baseUrl}/items`);
}

test("signed-in user sees the Items page headed exactly Your items", async ({ page }) => {
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = credentials();

  await signIn(page, email, password);

  await expect(page).toHaveURL(`${baseUrl}/items`);
  await expect(page.getByTestId("items-heading")).toHaveText("Your items");
  // The page's only level-1 heading is the items-heading element.
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveAttribute("data-testid", "items-heading");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your items");
});

test("old Items heading is replaced, not added beside, and the Items nav link stays a link", async ({ page }) => {
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);

  await page.goto(`${baseUrl}/items`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your items");
  await expect(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
  const navItems = page.getByTestId("nav-items");
  await expect(navItems).toHaveText("Items");
  await expect(navItems).toHaveAttribute("href", "/items");
  await expect(page.getByRole("link", { name: "Items", exact: true })).toHaveAttribute("data-testid", "nav-items");
});

test("sign in and add an item on the Your items page", async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(pageTimeout);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = credentials();
  const itemName = `J1 item ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await test.step("1. sign in at /login and land on /items", async () => {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step("2. see the Your items heading and the sign-in status", async () => {
    await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  });

  await test.step("3. add a uniquely named item", async () => {
    await page.getByLabel("New item").fill(itemName);
    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith("/api/items") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Add item" }).click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect.soft(response.status()).toBe(201);
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("items-list").getByTestId("item").last()).toHaveText(itemName);
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
  });

  await test.step("4. reload /items and see the heading and the added item still there", async () => {
    await page.reload();
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
    await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    await expect.soft(page.getByTestId("add-item-form")).toBeVisible();
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expect.soft(page.getByTestId("items-list").getByTestId("item").last()).toHaveText(itemName);
    await expect.soft(page.getByTestId("items-list").getByTestId("item").filter({ hasText: itemName })).toHaveCount(1);
  });
});
