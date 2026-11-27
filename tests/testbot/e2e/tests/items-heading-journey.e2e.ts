import { test, expect, checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { baseUrl, loginCredentials } from "../support/sign-in";

test("sign in, see my items under the Your items heading, add one and keep it after a reload", async ({ page }) => {
  test.setTimeout(60000);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = loginCredentials();
  const itemName = `Journey item ${Date.now()}`;
  const addedItem = page.getByTestId("items-list").getByTestId("item").filter({ hasText: itemName });

  await test.step("1. sign in on /login and land on /items", async () => {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    const loginResponse = page.waitForResponse((r) => r.url() === `${baseUrl}/login` && r.request().method() === "POST");
    await page.getByRole("button", { name: "Sign in" }).click();
    await loginResponse;
    await expect(page).toHaveURL(`${baseUrl}/items`);
    await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  });

  await test.step("2. the Items page heading reads Your items", async () => {
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText("Your items");
    await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
  });

  await test.step("3. add an item", async () => {
    const input = page.getByLabel("New item");
    await input.fill(itemName);
    const addResponse = page.waitForResponse((r) => r.url() === `${baseUrl}/api/items` && r.request().method() === "POST");
    await page.getByRole("button", { name: "Add item" }).click();
    const response = await addResponse;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect(response.status()).toBe(201);
    await expect(addedItem).toHaveText(itemName);
    await expect(input).toHaveValue("");
    await expect(page.getByTestId("item-error")).toBeHidden();
  });

  await test.step("4. after a reload the heading, the item and the status remain", async () => {
    await page.reload();
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText("Your items");
    await expect(addedItem).toHaveCount(1);
    await expect(addedItem).toHaveText(itemName);
    await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    await expect(page.getByTestId("item-error")).toBeHidden();
  });
});
