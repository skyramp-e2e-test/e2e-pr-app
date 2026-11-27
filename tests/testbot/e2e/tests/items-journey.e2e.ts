// Drafted with the Skyramp walk helper, then strengthened.
import { test, expect } from "@playwright/test";
import { checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { baseUrl, loginFromEnv } from "../support/sign-in";

test("sign in, land on Your items and add an item that stays after reload", async ({ page }) => {
  test.setTimeout(60000);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = loginFromEnv();
  // Items cannot be deleted through the app, so the name is unique to this run.
  const itemName = `Journey item ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const heading = page.getByTestId("items-heading");
  const h1 = page.getByRole("heading", { level: 1 });
  const items = page.getByTestId("item");

  await test.step("1. sign in on /login and land on /items", async () => {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step("2. the page is headed Your items and shows who is signed in", async () => {
    await expect.soft(h1).toHaveCount(1);
    await expect.soft(heading).toHaveText("Your items");
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  });

  await test.step("3. add an item", async () => {
    await page.getByLabel("New item").fill(itemName);
    const responsePromise = page.waitForResponse(
      (r) => r.url() === `${baseUrl}/api/items` && r.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Add item" }).click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect.soft(response.status()).toBe(201);
    // New items are listed in creation order, so the one just added is last.
    await expect.soft(items.filter({ hasText: itemName })).toHaveText(itemName);
    await expect.soft.poll(async () => (await items.allTextContents()).at(-1)).toBe(itemName);
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
  });

  await test.step("4. reload: heading, status and the added item persist", async () => {
    await page.reload();
    await expect(h1).toHaveCount(1);
    await expect(heading).toHaveText("Your items");
    await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    await expect(items.filter({ hasText: itemName })).toHaveCount(1);
    await expect.poll(async () => (await items.allTextContents()).at(-1)).toBe(itemName);
    await expect(page.getByTestId("item-error")).toBeHidden();
  });
});
