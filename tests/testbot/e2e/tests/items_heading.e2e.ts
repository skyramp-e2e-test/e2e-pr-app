// Journey: sign in from the home page and add an item on the Items page, headed "Your items".
import { test, expect, getBaseUrl, checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { submitSignIn, testAccount } from "./sign-in";

const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

test("sign in and add an item on the Your items page", async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(15000);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = testAccount();
  // The app has no way to delete items, so each run adds one item with a name unique to it.
  const itemName = `Heading journey ${Date.now()}`;
  const heading = page.getByTestId("items-heading");
  const list = page.getByTestId("items-list");
  const items = list.getByTestId("item");
  let countBefore = 0;

  await test.step("1. open / and click the nav Login link", async () => {
    await page.goto(`${baseUrl}/`);
    await page.getByTestId("nav-login").click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  await test.step("2. sign in and land on the Your items page", async () => {
    await submitSignIn(page, email, password);
    await expect.soft(page).toHaveURL(`${baseUrl}/items`);
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect.soft(page.getByRole("heading", { name: "Your items", exact: true })).toHaveCount(1);
    await expect.soft(heading).toHaveText("Your items");
    await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
    await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  });

  await test.step("3. add an item with a unique name", async () => {
    // The page lists every item /api/items returns; wait until it shows them all before adding.
    countBefore = ((await (await page.request.get(`${baseUrl}/api/items`)).json()) as unknown[]).length;
    await expect(items).toHaveCount(countBefore);
    await page.getByLabel("New item").fill(itemName);
    const posted = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Add item" }).click();
    const response = await posted;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect.soft(response.status()).toBe(201);
    await expect.soft(items).toHaveCount(countBefore + 1);
    await expect.soft(list.getByText(itemName, { exact: true })).toHaveCount(1);
    // The order is what this checks: the new item is the last entry of the list.
    expect.soft((await items.allTextContents()).at(-1)).toBe(itemName);
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expect.soft(heading).toHaveText("Your items");
  });

  await test.step("4. reload /items: heading, status and the new item persist", async () => {
    const loaded = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "GET");
    await page.reload();
    await loaded;
    await expect.soft(page).toHaveURL(`${baseUrl}/items`);
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect.soft(heading).toHaveText("Your items");
    await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    await expect.soft(items).toHaveCount(countBefore + 1);
    await expect.soft(list.getByText(itemName, { exact: true })).toHaveCount(1);
    // The order is what this checks: the new item is the last entry of the list.
    expect.soft((await items.allTextContents()).at(-1)).toBe(itemName);
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    const nav = page.getByRole("navigation");
    await expect.soft(nav.getByRole("link", { name: "Home", exact: true })).toBeVisible();
    await expect.soft(nav.getByRole("link", { name: "Login", exact: true })).toBeVisible();
    await expect.soft(nav.getByRole("link", { name: "Items", exact: true })).toBeVisible();
    await expect.soft(nav.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
  });
});
