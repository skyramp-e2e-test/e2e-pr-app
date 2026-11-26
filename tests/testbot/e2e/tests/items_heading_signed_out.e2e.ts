// The Items page is headed "Your items" for a visitor who is not signed in.
import { test, expect, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";

const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

test("items page shows the single heading Your items when signed out", async ({ page }) => {
  page.setDefaultTimeout(15000);
  page = newSkyrampPlaywrightPage(page);

  await test.step("open /items without a session", async () => {
    const response = await page.goto(`${baseUrl}/items`);
    expect(response?.status()).toBe(200);
    const html = (await response?.text()) ?? "";
    expect.soft(html).toContain('<h1 data-testid="items-heading">Your items</h1>');
    expect.soft(html.match(/<h1[\s>]/g) ?? []).toHaveLength(1);
  });

  await test.step("the page has one h1, reading exactly Your items", async () => {
    await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText("Your items");
    await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
  });

  await test.step("the status line says the visitor is not signed in", async () => {
    await expect.soft(page.getByTestId("user-status")).toHaveText("You are not signed in.");
  });
});
