import { test, expect, checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { baseUrl, itemsPage, uiLogin } from "../support/items-app";

test.use({ viewport: { width: 1280, height: 900 } });

test("signed-in user adds an item on the Your items page and it stays after reload", async ({ page }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  page = newSkyrampPlaywrightPage(page);

  const { username, password } = uiLogin();
  const items = itemsPage(page);
  const newName = `Journey item ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  let countBefore = 0;
  let namesBefore: string[] = [];

  await test.step("1. sign in at /login and land on /items", async () => {
    await page.goto(`${baseUrl}/login`);
    await page.getByTestId("email-input").fill(username);
    await page.getByTestId("password-input").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(`${baseUrl}/items`);
  });

  await test.step("2. the Items page shows the 'Your items' heading and the signed-in user", async () => {
    await expect.soft(items.yourItemsHeading).toBeVisible();
    await expect.soft(items.heading).toHaveText(["Your items"]);
    await expect.soft(items.heading).toHaveText("Your items");
    await expect.soft(items.oldItemsHeading).toHaveCount(0);
    await expect.soft(items.userStatus).toHaveText(`Signed in as ${username}`);
    // The list has loaded once GET /api/items has answered; count what is there before adding.
    const listed = await (await page.request.get(`${baseUrl}/api/items`)).json();
    await expect(items.items).toHaveCount(listed.length);
    countBefore = listed.length;
    namesBefore = listed.map((item: { name: string }) => item.name);
  });

  await test.step("3. add a uniquely named item", async () => {
    await items.newItemInput.fill(newName);
    const posted = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "POST");
    await items.addItemButton.click();
    const response = await posted;
    checkRequestPayload(response.request().postDataJSON(), { name: newName });
    expect.soft(response.status()).toBe(201);
    await expect.soft(items.newItemInput).toHaveValue("");
    await expect.soft(items.itemError).toBeHidden();
    await expect.soft(items.items).toHaveCount(countBefore + 1);
    // The new item is the last entry: the whole list, in order, is what was there plus the new name.
    await expect.soft(items.items).toHaveText([...namesBefore, newName]);
  });

  await test.step("4. reload /items: heading and the new item persist", async () => {
    await page.reload();
    await expect.soft(items.heading).toHaveText(["Your items"]);
    await expect.soft(items.oldItemsHeading).toHaveCount(0);
    await expect.soft(items.userStatus).toHaveText(`Signed in as ${username}`);
    await expect.soft(items.items).toHaveCount(countBefore + 1);
    // The new item is the last entry: the whole list, in order, is what was there plus the new name.
    await expect.soft(items.items).toHaveText([...namesBefore, newName]);
    await expect.soft(items.items.filter({ hasText: newName })).toHaveCount(1);
    await expect.soft(items.itemError).toBeHidden();
    await expect.soft(items.newItemInput).toHaveValue("");
  });
});
