// Items page: the "Your items" heading and adding items through the form, signed in through /login.
// Drafted from Skyramp walks of the page (add an item; add a 51-character name), then strengthened.
import { test, checkRequestPayload, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";

const baseUrl = process.env.SKYRAMP_TEST_SERVICE_URL_UI || process.env.SKYRAMP_TEST_BASE_URL || "http://localhost:3000";

// Names this file creates start with "tbe2e-" so they can be found (the app has no delete endpoint).
function uniqueName(label: string, length?: number): string {
  const name = `tbe2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return length === undefined ? name : name.padEnd(length, "z").slice(0, length);
}

async function signIn(page: Page): Promise<void> {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set");
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
}

async function addItem(page: Page, name: string) {
  await page.getByLabel("New item").fill(name);
  const responsePromise = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Add item" }).click();
  const response = await responsePromise;
  checkRequestPayload(response.request().postDataJSON(), { name });
  return response;
}

test.describe("Items page", () => {
  test.beforeEach(({ page }) => {
    page.setDefaultTimeout(15000);
  });

  test("signed-in user sees the heading Your items", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await signIn(page);
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText("Your items");
    await expect(page.getByTestId("items-heading")).toHaveText("Your items");
    await expect(page.getByRole("heading", { level: 1, name: "Your items", exact: true })).toHaveAttribute("data-testid", "items-heading");
    await expect(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
  });

  test("heading stays Your items after adding an item and after a reload", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const name = uniqueName("heading");
    await signIn(page);
    await expect(page.getByTestId("items-heading")).toHaveText("Your items");
    const response = await addItem(page, name);
    expect(response.status()).toBe(201);
    await expect(page.getByTestId("item").filter({ hasText: name })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your items");
    await page.goto(`${baseUrl}/items`);
    await expect(page.getByTestId("item").filter({ hasText: name })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your items");
    await expect(page.getByTestId("items-heading")).toHaveText("Your items");
  });

  test("a 51-character name shows the too-long error and is not added", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const name = uniqueName("long", 51);
    expect(name).toHaveLength(51);
    await signIn(page);
    await expect(page.getByTestId("items-heading")).toHaveText("Your items");
    await addItem(page, name);
    await expect(page.getByTestId("item-error")).toBeVisible();
    await expect(page.getByTestId("item-error")).toHaveText(/too long/i);
    await expect(page.getByLabel("New item")).toHaveValue(name);
    await expect(page.getByTestId("item").filter({ hasText: name })).toHaveCount(0);
    await page.goto(`${baseUrl}/items`);
    await expect(page.getByTestId("items-heading")).toHaveText("Your items");
    await expect(page.getByTestId("item").filter({ hasText: name })).toHaveCount(0);
  });

  test("journey: sign in, open my items, add an item", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const name = uniqueName("J1 milk");
    const username = process.env.SKYRAMP_UI_USERNAME;

    await test.step("1. sign in at /login and land on /items", async () => {
      await signIn(page);
    });

    await test.step("2. the Items page shows Your items and the signed-in user", async () => {
      await expect.soft(page.getByRole("heading", { level: 1, name: "Your items", exact: true })).toBeVisible();
      await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
      await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
      await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
      await expect.soft(page.getByTestId("item").filter({ hasText: name })).toHaveCount(0);
    });

    await test.step("3. add an item through the form", async () => {
      const response = await addItem(page, name);
      expect.soft(response.status()).toBe(201);
      await expect.soft(page.getByTestId("item").filter({ hasText: name })).toHaveCount(1);
      await expect.soft(page.getByLabel("New item")).toHaveValue("");
      await expect.soft(page.getByTestId("item-error")).toBeHidden();
      await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
    });

    await test.step("4. reload /items: the heading and the added item remain", async () => {
      await page.reload();
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText("Your items");
      await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${username}`);
      await expect.soft(page.getByTestId("item").filter({ hasText: name })).toHaveCount(1);
      await expect.soft(page.getByTestId("item-error")).toBeHidden();
    });
  });

  test("journey: try to add an item with a name that is too long", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const name = uniqueName("J2", 51);

    await test.step("1. sign in and land on /items with heading Your items", async () => {
      await signIn(page);
      await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
    });

    await test.step("2. submit a 51-character name: the error shows and the list does not get it", async () => {
      await addItem(page, name);
      await expect.soft(page.getByTestId("item-error")).toBeVisible();
      await expect.soft(page.getByTestId("item-error")).toHaveText(/too long/i);
      await expect.soft(page.getByLabel("New item")).toHaveValue(name);
      await expect.soft(page.getByTestId("item").filter({ hasText: name })).toHaveCount(0);
      await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
    });

    await test.step("3. reload /items: the 51-character name is not in the list", async () => {
      await page.reload();
      await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
      await expect.soft(page.getByTestId("item").filter({ hasText: name })).toHaveCount(0);
    });
  });
});
