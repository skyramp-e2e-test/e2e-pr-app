// Journey: sign in, see the Items page headed Your items, and add an item.
// Drafted with the Skyramp walk helper, then fitted to the support page objects.
import { test, expect, checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { baseUrl, ItemsPage, LoginPage, uiLogin } from "../support/items-page";

test.use({ viewport: { width: 1280, height: 900 } });

test("sign in, see Your items heading, and add an item", async ({ page }) => {
  test.setTimeout(60000);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = uiLogin();
  const login = new LoginPage(page);
  const items = new ItemsPage(page);
  // The app has no item delete endpoint, so this item stays; its name is unique to the run.
  const name = `Journey item ${Date.now()}`;
  let before: string[] = [];

  await test.step("1. open / and follow the Login link", async () => {
    await page.goto(`${baseUrl}/`);
    await page.getByTestId("nav-login").click();
    await expect(login.heading).toBeVisible();
  });

  await test.step("2. sign in", async () => {
    const listLoaded = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "GET");
    await login.signIn(email, password);
    await expect(page).toHaveURL(`${baseUrl}/items`);
    await listLoaded;
  });

  await test.step("3. the Items page is headed Your items", async () => {
    await expect.soft(items.headingByTestId).toHaveText("Your items");
    await expect.soft(items.heading).toHaveCount(1);
    await expect.soft(items.heading).toHaveText("Your items");
    await expect.soft(items.oldHeading).toHaveCount(0);
    await expect.soft(items.userStatus).toHaveText(`Signed in as ${email}`);
  });

  await test.step("4. add an item", async () => {
    before = await items.items.allTextContents();
    await items.newItem.fill(name);
    const responsePromise = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "POST");
    await items.addItem.click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name });
    expect.soft(response.status()).toBe(201);
    await expect.soft(items.item(name)).toHaveText(name);
    await expect.soft(items.newItem).toHaveValue("");
    await expect.soft(items.itemError).toBeHidden();
  });

  await test.step("5. reload /items and the heading and item remain", async () => {
    await items.goto();
    await expect(items.heading).toHaveCount(1);
    await expect(items.heading).toHaveText("Your items");
    await expect(page.getByRole("heading", { name: "Your items" })).toBeVisible();
    await expect(items.oldHeading).toHaveCount(0);
    await expect(items.userStatus).toHaveText(`Signed in as ${email}`);
    await expect(items.itemError).toBeHidden();
    await expect(items.newItem).toHaveValue("");
    await expect(items.item(name)).toHaveText(name);
    await expect(items.item(name)).toHaveCount(1);
    const after = await items.items.allTextContents();
    const mine = after.indexOf(name);
    // Every item listed before the add is still listed, in order, ahead of the new one.
    // The new item is the last one listed.
    expect(after[after.length - 1]).toBe(name);
    expect(after.slice(0, mine).filter((n) => before.includes(n))).toEqual(before);
  });
});
