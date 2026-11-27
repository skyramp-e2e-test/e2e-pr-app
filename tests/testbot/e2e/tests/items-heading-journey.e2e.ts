// Journey: sign in, see my items under the new heading, and add one.
import { test, expect } from "@playwright/test";
import { checkRequestPayload } from "@skyramp/skyramp";
import { baseUrl, ItemsPage, LoginPage, skyrampPage, uniqueItemName } from "../support/items-page";

test('sign in, see my items under the heading "Your items", add one and still see it after a reload', async ({ page }) => {
  page = skyrampPage(page);
  const login = new LoginPage(page);
  const items = new ItemsPage(page);
  const expectedStatus = `Signed in as ${process.env.SKYRAMP_UI_USERNAME}`;
  const name = uniqueItemName();
  let before: string[] = [];

  await test.step("1. sign in through /login and land on /items", async () => {
    await login.goto();
    const listLoaded = items.waitForList();
    await login.signInAsTestUser();
    await expect.soft(page).toHaveURL(`${baseUrl}/items`);
    const listed = await listLoaded;
    await expect.soft(items.items).toHaveCount(listed.length);
  });

  await test.step("2. the Items page shows the heading \"Your items\", the nav link and the status line", async () => {
    await expect.soft(items.heading).toHaveCount(1);
    await expect.soft(items.heading).toHaveText("Your items");
    await expect.soft(items.oldHeading).toHaveCount(0);
    await expect.soft(items.navItems).toHaveText("Items");
    await expect.soft(items.userStatus).toHaveText(expectedStatus);
    before = await items.itemNames();
  });

  await test.step("3. add an item through the form", async () => {
    await items.newItemInput.fill(name);
    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith("/api/items") && r.request().method() === "POST",
    );
    await items.addItemButton.click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name });
    await expect.soft(items.item(name)).toHaveCount(1);
    // The order is what this checks: the new item is the list's last entry.
    expect.soft((await items.itemNames()).at(-1)).toBe(name);
    await expect.soft(items.newItemInput).toHaveValue("");
    await expect.soft(items.itemError).toBeHidden();
  });

  await test.step("4. after a reload the heading and the added item are still there", async () => {
    const listLoaded = items.waitForList();
    await items.goto();
    const listed = await listLoaded;
    await expect.soft(items.items).toHaveCount(listed.length);
    await expect.soft(items.heading).toHaveText("Your items");
    await expect.soft(items.oldHeading).toHaveCount(0);
    await expect.soft(items.userStatus).toHaveText(expectedStatus);
    await expect.soft(items.newItemInput).toHaveValue("");
    await expect.soft(items.itemError).toBeHidden();
    await expect.soft(items.item(name)).toHaveCount(1);
    // The order is what this checks: the new item is the list's last entry.
    expect.soft((await items.itemNames()).at(-1)).toBe(name);
    // Every item listed before is still listed, in the same order, ahead of the new one.
    const after = await items.itemNames();
    const beforeStillListed = after.filter((n) => before.includes(n));
    expect.soft(beforeStillListed).toEqual(before);
    expect.soft(after.indexOf(name)).toBe(after.length - 1);
  });
});
