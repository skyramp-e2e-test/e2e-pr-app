import { test, expect, checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { ItemsPage, LoginPage, requiredEnv } from "../support/items-pages";

test("sign in, view my items and add one", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const email = requiredEnv("SKYRAMP_UI_USERNAME");
  const password = requiredEnv("SKYRAMP_UI_PASSWORD");
  const login = new LoginPage(page);
  const items = new ItemsPage(page);
  const itemName = `Journey item ${Date.now()}`;

  await test.step("1. sign in at /login and land on /items", async () => {
    await login.goto();
    const loginResponse = page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/login",
    );
    await login.signInAs(email, password);
    const response = await loginResponse;
    expect.soft(response.status()).toBe(303);
    expect.soft(response.headers()["location"]).toBe("/items");
    await expect(page).toHaveURL(/\/items$/);
  });

  await test.step("2. the heading is Your items and the status names the user", async () => {
    await expect.soft(items.mainHeading).toHaveCount(1);
    await expect.soft(items.mainHeading).toHaveText("Your items");
    await expect.soft(items.bareItemsHeading).toHaveCount(0);
    await expect.soft(items.userStatus).toHaveText(`Signed in as ${email}`);
  });

  await test.step("3. add an item", async () => {
    await items.newItem.fill(itemName);
    const addResponse = page.waitForResponse(
      (r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/api/items",
    );
    await items.addItem.click();
    const response = await addResponse;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect.soft(response.status()).toBe(201);
    await expect.soft(items.item(itemName)).toHaveCount(1);
    await expect.soft.poll(async () => (await items.items.allTextContents()).at(-1)).toBe(itemName);
    await expect.soft(items.newItem).toHaveValue("");
    await expect.soft(items.itemError).toBeHidden();
    await expect.soft(items.mainHeading).toHaveText("Your items");
  });

  await test.step("4. reload /items and the item and heading persist", async () => {
    const listed = page.waitForResponse(
      (r) => r.request().method() === "GET" && new URL(r.url()).pathname === "/api/items",
    );
    await items.goto();
    const apiItems: { id: number; name: string }[] = await (await listed).json();
    const ids = apiItems.map((i) => i.id);
    expect.soft(ids).toEqual([...ids].sort((a, b) => a - b));

    await expect.soft(items.mainHeading).toHaveCount(1);
    await expect.soft(items.mainHeading).toHaveText("Your items");
    await expect.soft(items.bareItemsHeading).toHaveCount(0);
    await expect.soft(items.userStatus).toHaveText(`Signed in as ${email}`);
    await expect.soft(items.items).toHaveText(apiItems.map((i) => i.name));
    await expect.soft.poll(async () => (await items.items.allTextContents()).at(-1)).toBe(itemName);
    await expect.soft(items.item(itemName)).toHaveCount(1);
    await expect.soft(items.newItem).toHaveValue("");
    await expect.soft(items.itemError).toBeHidden();
    await expect.soft(items.navHome).toHaveText("Home");
    await expect.soft(items.navLogin).toHaveText("Login");
    await expect.soft(items.navItems).toHaveText("Items");
    await expect.soft(items.signOut).toHaveText("Sign out");
  });
});
