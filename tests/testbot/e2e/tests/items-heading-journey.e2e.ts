// Journey: sign in, open the Items list, add an item and see it under the "Your items" heading after a reload.
import { test, expect, getBaseUrl, newSkyrampPlaywrightPage, checkRequestPayload } from "@skyramp/skyramp";

const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

test.use({ viewport: { width: 1280, height: 900 } });

test("sign in, add an item and see it under the Your items heading", async ({ page }) => {
  test.setTimeout(60000);
  page = newSkyrampPlaywrightPage(page);
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in");
  }
  const itemName = `Walk item ${Date.now()}`;
  let namesBefore: string[] = [];

  await test.step("1. open Login from the nav", async () => {
    await page.goto(`${baseUrl}/`);
    await page.getByTestId("nav-login").click();
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  await test.step("2. sign in", async () => {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(`${baseUrl}/items`);
    await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  });

  await test.step("3. read the page heading", async () => {
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
    await expect.soft(page.getByRole("heading", { name: "Your items", level: 1, exact: true })).toBeVisible();
  });

  await test.step("4. add an item", async () => {
    const before = await page.request.get(`${baseUrl}/api/items`);
    expect(before.status()).toBe(200);
    namesBefore = ((await before.json()) as { name: string }[]).map((i) => i.name);
    await expect(page.getByTestId("item")).toHaveCount(namesBefore.length);

    await page.getByLabel("New item").fill(itemName);
    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith("/api/items") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Add item" }).click();
    const response = await responsePromise;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect(response.status()).toBe(201);

    await expect(page.getByLabel("New item")).toHaveValue("");
    await expect(page.getByTestId("item-error")).toBeHidden();
    // Order is what is checked: every earlier item in id order, then the added item last.
    await expect(page.getByTestId("items-list").getByTestId("item")).toHaveText([...namesBefore, itemName]);
  });

  await test.step("5. reload Items and check the outcome", async () => {
    await page.reload();
    await expect(page).toHaveURL(`${baseUrl}/items`);
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
    await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    await expect(page.getByTestId("items-list").getByTestId("item")).toHaveText([...namesBefore, itemName]);
    await expect(page.getByTestId("item-error")).toBeHidden();
    await expect(page.getByLabel("New item")).toHaveValue("");
  });
});
