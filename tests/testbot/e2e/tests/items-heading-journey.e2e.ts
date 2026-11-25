import { test, expect } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { LoginPage, testUserEmail } from "../pages/login-page";
import { ItemsPage } from "../pages/items-page";

// Items this test adds stay in the app: it exposes no way to delete an item.
// Each is named "Heading check <timestamp>" so it can be told apart.
test("sign in, open the items list and add an item under the All items heading", async ({ page: rawPage }, testInfo) => {
  const page = newSkyrampPlaywrightPage(rawPage, testInfo);
  const login = new LoginPage(page);
  const items = new ItemsPage(page);
  const email = testUserEmail();
  const itemName = `Heading check ${Date.now()}-${testInfo.workerIndex}`;
  let countBefore = 0;
  let namesBefore: string[] = [];

  await test.step("1. sign in at /login and land on /items", async () => {
    await login.goto();
    await login.signInAsTestUser();
    await expect(page).toHaveURL(/\/items$/);
  });

  await test.step("2. view the items page", async () => {
    await items.waitForStatus();
    await expect.soft(items.heading()).toHaveText("All items", { useInnerText: true });
    await expect.soft(items.headingNamed("Items")).toHaveCount(0);
    await expect.soft(items.userStatus()).toHaveText(`Signed in as ${email}`);
    // The list is filled by the page's own /api/items call; read it once it has answered.
    const listed = await page.request.get("/api/items");
    expect(listed.ok()).toBe(true);
    countBefore = (await listed.json()).length;
    await expect(items.items()).toHaveCount(countBefore);
    namesBefore = await items.items().allInnerTexts();
  });

  await test.step("3. add a uniquely named item", async () => {
    await items.newItem().fill(itemName);
    const posted = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/items");
    await items.addItem().click();
    expect.soft((await posted).postDataJSON()).toEqual({ name: itemName });
    await expect.soft(items.items()).toHaveCount(countBefore + 1);
    await expect.soft(items.item(itemName)).toHaveCount(1);
    // The whole list, in order: every earlier item, then the new one at the end.
    await expect.soft(items.items()).toHaveText([...namesBefore, itemName]);
    await expect.soft(items.newItem()).toHaveValue("");
    await expect.soft(items.error()).toBeHidden();
    await expect.soft(items.heading()).toHaveText("All items", { useInnerText: true });
  });

  await test.step("4. reload the page", async () => {
    await page.reload();
    await items.waitForStatus();
    await expect.soft(items.heading()).toHaveText("All items", { useInnerText: true });
    await expect.soft(items.headingNamed("Items")).toHaveCount(0);
    await expect.soft(items.userStatus()).toHaveText(`Signed in as ${email}`);
    await expect.soft(items.items()).toHaveCount(countBefore + 1);
    await expect.soft(items.item(itemName)).toHaveCount(1);
    await expect.soft(items.items()).toHaveText([...namesBefore, itemName]);
    await expect.soft(items.error()).toBeHidden();
  });
});
