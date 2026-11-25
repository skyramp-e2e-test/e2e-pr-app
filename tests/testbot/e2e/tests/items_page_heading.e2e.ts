// The Items page (GET /items) is headed "Your items", with data-testid="items-heading".
import { test, expect, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { submitSignIn, testAccount } from "./sign-in";

const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

test.describe("Items page heading", () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(15000);
  });

  test("shows the single h1 as Your items for a signed-in user and a signed-out visitor", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const { email, password } = testAccount();

    await test.step("sign in through /login and land on /items", async () => {
      await page.goto(`${baseUrl}/login`);
      await submitSignIn(page, email, password);
      await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    });

    await test.step("signed in: the only h1 reads exactly Your items, no Items heading", async () => {
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText("Your items");
      await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
    });

    await test.step("sign out and open /items from the nav Items link", async () => {
      await page.getByTestId("logout-button").click();
      await page.waitForURL(`${baseUrl}/`);
      await page.getByTestId("nav-items").click();
      await page.waitForURL(`${baseUrl}/items`);
      await expect(page.getByTestId("user-status")).toHaveText("You are not signed in.");
    });

    await test.step("signed out: the only h1 still reads exactly Your items", async () => {
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText("Your items");
      await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
    });
  });

  test("heading carries data-testid items-heading on the h1", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    await page.goto(`${baseUrl}/items`);

    const byTestId = page.getByTestId("items-heading");
    await expect(byTestId).toHaveCount(1);
    await expect(byTestId).toHaveText("Your items");
    // It is the h1, and the same element the heading role finds by its name.
    await expect(byTestId).toHaveRole("heading");
    expect(await byTestId.evaluate((el) => el.tagName)).toBe("H1");
    await expect(page.getByRole("heading", { level: 1 })).toHaveAttribute("data-testid", "items-heading");
    await expect(page.getByRole("heading", { name: "Your items", exact: true })).toHaveAttribute("data-testid", "items-heading");
  });

  test("signed-out visitor reaching Items from the nav sees Your items and the unchanged page", async ({ page, context }) => {
    page = newSkyrampPlaywrightPage(page);
    await context.clearCookies();

    await test.step("open / and click the nav Items link", async () => {
      await page.goto(`${baseUrl}/`);
      await page.getByTestId("nav-items").click();
      await expect(page.getByTestId("user-status")).toHaveText("You are not signed in.");
    });

    await test.step("the Items page shows Your items as its only h1", async () => {
      await expect.soft(page).toHaveURL(`${baseUrl}/items`);
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText("Your items");
      await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
      await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
    });

    await test.step("nav and page title are unchanged", async () => {
      const nav = page.getByRole("navigation");
      await expect.soft(nav.getByRole("link", { name: "Home", exact: true })).toBeVisible();
      await expect.soft(nav.getByRole("link", { name: "Login", exact: true })).toBeVisible();
      await expect.soft(nav.getByRole("link", { name: "Items", exact: true })).toBeVisible();
      await expect.soft(nav.getByRole("button", { name: "Sign out", exact: true })).toBeVisible();
      await expect.soft(page).toHaveTitle("Items - E2E PR App");
    });
  });
});
