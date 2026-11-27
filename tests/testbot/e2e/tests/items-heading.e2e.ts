import { test, expect, checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { LoginPage } from "../pages/login-page";
import { ItemsPage } from "../pages/items-page";

// The app has no API to delete an item: what this test adds is removed by
// .skyramp/cleanup/delete-journey-items.sh (names start with "Journey item ").
test("sign in and add an item on my Items page", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const login = new LoginPage(page);
  const items = new ItemsPage(page);
  const itemName = `Journey item ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let email = "";

  await test.step("1. sign in at /login", async () => {
    await login.goto();
    email = await login.signInAsTestUser();
    await expect(page).toHaveURL(/\/items$/);
  });

  await test.step("2. read the Items page heading", async () => {
    await expect.soft(items.heading).toHaveText("Your items");
    await expect.soft(items.headingByTestId).toHaveText("Your items");
    await expect.soft(items.userStatus).toHaveText(`Signed in as ${email}`);
  });

  await test.step("3. add an item", async () => {
    await items.newItem.fill(itemName);
    const responsePromise = page.waitForResponse(
      (res) => res.url().endsWith("/api/items") && res.request().method() === "POST"
    );
    await items.addItem.click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect(response.status()).toBe(201);
    await expect(items.newItem).toHaveValue("");
    await expect(items.itemError).toBeHidden();
    await expect(items.item(itemName)).toHaveCount(1);
    await expect.poll(async () => (await items.items.allTextContents()).at(-1)).toBe(itemName);
  });

  await test.step("4. reload the Items page", async () => {
    await page.reload();
    await expect.soft(items.heading).toHaveText("Your items");
    await expect.soft(items.headingByTestId).toHaveText("Your items");
    await expect(items.userStatus).toHaveText(`Signed in as ${email}`);
    await expect(items.itemError).toBeHidden();
    await expect(items.item(itemName)).toHaveCount(1);
    await expect.poll(async () => (await items.items.allTextContents()).at(-1)).toBe(itemName);
    const apiItems: { id: number; name: string }[] = await (await page.request.get("/api/items")).json();
    const ids = apiItems.map((item) => item.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    await expect(items.items).toHaveText(apiItems.map((item) => item.name));
  });
});
