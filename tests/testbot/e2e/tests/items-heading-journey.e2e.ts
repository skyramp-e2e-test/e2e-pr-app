// Journey: sign in, land on my items, add an item, reload; the Items page heading reads "Your items" throughout.
import { test, expect, type Page } from "@playwright/test";
import { checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";

const baseUrl = process.env.SKYRAMP_TEST_BASE_URL || "http://localhost:3000";

async function expectSingleHeading(page: Page) {
  const h1 = page.getByRole("heading", { level: 1 });
  await expect.soft(h1).toHaveCount(1);
  await expect.soft(h1).toHaveText("Your items", { useInnerText: true });
  await expect.soft(page.getByRole("heading", { name: "Your items", exact: true })).toBeVisible();
  await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
}

test("sign in, land on my items and add an item", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in");
  }
  const itemName = `Journey item ${Date.now()}`;
  const items = page.getByTestId("items-list").getByTestId("item");
  const addedItem = items.filter({ hasText: itemName });
  let before: string[] = [];

  await test.step("1. sign in at /login and land on /items", async () => {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    const itemsLoaded = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "GET");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`${baseUrl}/items`);
    before = ((await (await itemsLoaded).json()) as { name: string }[]).map((i) => i.name);
  });

  await test.step("2. the Items page shows the heading Your items and who is signed in", async () => {
    await expectSingleHeading(page);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    await expect.soft(items).toHaveCount(before.length);
  });

  await test.step("3. add an item", async () => {
    await page.getByLabel("New item").fill(itemName);
    const posted = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Add item" }).click();
    const response = await posted;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect.soft(response.status()).toBe(201);
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expect.soft(items).toHaveCount(before.length + 1);
    await expect.soft(addedItem).toHaveCount(1);
    await expect.soft(addedItem).toHaveText(itemName);
    // Ordered by creation: every item that was there before comes first, the new one last.
    await expect.soft(items).toHaveText([...before, itemName]);
  });

  await test.step("4. reload /items: heading, status and the added item persist", async () => {
    await page.reload();
    await expectSingleHeading(page);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expect.soft(addedItem).toHaveCount(1);
    await expect.soft(addedItem).toHaveText(itemName);
    // Ordered by creation: every item that was there before comes first, the new one last.
    await expect.soft(items).toHaveText([...before, itemName]);
  });
});
