// Started from a Skyramp walk recording (skyramp generate ui rest), then fitted to this package.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";

const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

// Names unique to this run; both start with "nl" so .skyramp/cleanup can find them.
const runId = `nl${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}-`;
const name51 = runId.padEnd(51, "z");
const name50 = runId.padEnd(50, "z");

function itemsPage(page: Page) {
  return {
    navItems: page.getByTestId("nav-items"),
    form: page.getByTestId("add-item-form"),
    nameInput: page.getByLabel("New item"),
    addButton: page.getByRole("button", { name: "Add item" }),
    error: page.getByTestId("item-error"),
    list: page.getByTestId("items-list"),
    itemNamed: (name: string) => page.getByTestId("items-list").getByText(name, { exact: true }),
  };
}

function waitForItemPost(page: Page) {
  return page.waitForResponse(
    (res) => res.request().method() === "POST" && new URL(res.url()).pathname === "/api/items",
  );
}

test("a too-long item name is refused with an error and not saved, a 50-character name is added and kept", async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(15000);
  page = newSkyrampPlaywrightPage(page);
  const items = itemsPage(page);
  expect(name51).toHaveLength(51);
  expect(name50).toHaveLength(50);

  await test.step("1. open the Items page from the nav", async () => {
    await page.goto(`${baseUrl}/items`);
    await items.navItems.click();
    await expect(page).toHaveURL(/\/items$/);
    await expect.soft(items.form).toBeVisible();
    await expect.soft(items.list).toBeVisible();
    await expect.soft(items.error).toBeHidden();
  });

  await test.step("2. submit a 51-character name", async () => {
    await items.nameInput.fill(name51);
    const responsePromise = waitForItemPost(page);
    await items.addButton.click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name: name51 });
    expect.soft(response.status()).toBe(400);
    await expect.soft(items.error).toBeVisible();
    await expect.soft(items.error).toHaveText("name is too long");
    await expect.soft(items.itemNamed(name51)).toHaveCount(0);
  });

  await test.step("3. replace it with a 50-character name", async () => {
    await items.nameInput.fill(name50);
    const responsePromise = waitForItemPost(page);
    await items.addButton.click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name: name50 });
    expect.soft(response.status()).toBe(201);
    await expect.soft(items.error).toBeHidden();
    await expect.soft(items.itemNamed(name50)).toHaveCount(1);
  });

  await test.step("4. reload: the 50-character item is kept, the 51-character one never was", async () => {
    await page.reload();
    await expect(items.itemNamed(name50)).toHaveCount(1);
    await expect(items.itemNamed(name51)).toHaveCount(0);
  });
});
