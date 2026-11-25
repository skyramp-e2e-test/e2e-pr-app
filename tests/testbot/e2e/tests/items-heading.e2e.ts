import { test, expect, checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { baseUrl, expectItemsHeading, seededAccount, signIn } from "../support/items-app";

test.use({ viewport: { width: 1280, height: 900 } });

test("sign in, open my items and add an item", async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(15000);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = seededAccount();
  const itemName = `Journey item ${Date.now()}`;
  const items = page.getByTestId("item");
  let listedBefore: string[] = [];

  await test.step("1. open / and follow the Login link", async () => {
    await page.goto(`${baseUrl}/`);
    await page.getByTestId("nav-login").click();
    await expect(page).toHaveURL(`${baseUrl}/login`);
    await expect.soft(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  await test.step("2. sign in as the seeded user and land on /items", async () => {
    const listLoaded = page.waitForResponse(
      (r) => r.url() === `${baseUrl}/api/items` && r.request().method() === "GET",
    );
    await signIn(page, email, password);
    const listed: { name: string }[] = await (await listLoaded).json();
    listedBefore = listed.map((i) => i.name);
    await expect(items).toHaveCount(listedBefore.length);
  });

  await test.step("3. the Items page shows Your items as its one main heading", async () => {
    await expectItemsHeading(page);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  });

  await test.step("4. add an item", async () => {
    await page.getByLabel("New item").fill(itemName);
    const created = page.waitForResponse(
      (r) => r.url() === `${baseUrl}/api/items` && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Add item" }).click();
    const response = await created;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect.soft(response.status()).toBe(201);
    await expect.soft(items).toHaveText([...listedBefore, itemName]);
    await expect.soft(items.filter({ hasText: itemName })).toHaveCount(1);
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
  });

  await test.step("5. reload /items: heading, status and the added item persist", async () => {
    await page.reload();
    await expect(page).toHaveURL(`${baseUrl}/items`);
    await expectItemsHeading(page);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    await expect.soft(items).toHaveText([...listedBefore, itemName]);
    await expect.soft(items.filter({ hasText: itemName })).toHaveCount(1);
    await expect.soft(page.getByLabel("New item")).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
  });
});
