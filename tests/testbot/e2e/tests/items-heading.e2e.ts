// Drafted with the Skyramp walk helper, then strengthened.
import { test, expect } from "@playwright/test";
import { checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { signInFromHome, signedInStatus } from "./sign-in";

test("sign in, land on the items page headed 'Your items', and add an item", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const itemName = `Journey item ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const h1 = page.getByRole("heading", { level: 1 });
  const list = page.getByTestId("items-list");
  const rows = list.getByTestId("item");
  const newRow = rows.filter({ hasText: itemName });
  let namesBefore: string[] = [];

  await test.step("1-2. open /, sign in through Login and land on /items", async () => {
    await page.goto("/");
    await signInFromHome(page);
    await expect.soft(h1).toHaveCount(1);
    await expect.soft(h1).toHaveText(/^Your items$/);
    await expect.soft(page.getByRole("heading", { name: "Your items", exact: true })).toBeVisible();
    await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId("user-status")).toHaveText(signedInStatus());
  });

  await test.step("3. add an item", async () => {
    // Wait until the list the page loaded is rendered, then note its rows.
    namesBefore = ((await (await page.request.get("/api/items")).json()) as { name: string }[]).map((i) => i.name);
    await expect(rows).toHaveCount(namesBefore.length);
    await page.getByLabel("New item").fill(itemName);
    const responsePromise = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Add item" }).click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect.soft(response.status()).toBe(201);
    await expect.soft(newRow).toHaveCount(1);
    await expect.soft(newRow).toHaveText(itemName);
    // Order is what this step checks: every earlier row, then the new item last.
    await expect.soft(rows).toHaveText([...namesBefore, itemName]);
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expect.soft(h1).toHaveText(/^Your items$/);
  });

  await test.step("4. reload /items and see everything persisted", async () => {
    await page.goto("/items");
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText(/^Your items$/);
    await expect(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
    await expect(newRow).toHaveCount(1);
    await expect(newRow).toHaveText(itemName);
    await expect(rows).toHaveText([...namesBefore, itemName]);
    await expect(page.getByTestId("user-status")).toHaveText(signedInStatus());
    await expect(page.getByTestId("nav-home")).toHaveText("Home");
    await expect(page.getByTestId("nav-login")).toHaveText("Login");
    await expect(page.getByTestId("nav-items")).toHaveText("Items");
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByLabel("New item")).toHaveValue("");
    await expect(page.getByTestId("item-error")).toBeHidden();
  });
});
