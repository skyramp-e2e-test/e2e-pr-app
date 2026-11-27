// Drafted with the Skyramp walk helper, then strengthened.
import { test, expect } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { signInFromHome } from "./sign-in";

test("Items page shows the single heading 'Your items' after sign-in", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);

  await page.goto("/");
  await signInFromHome(page);

  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText(/^Your items$/);
  await expect(page.getByRole("heading", { name: "Your items", exact: true })).toBeVisible();
  // The old heading is gone.
  await expect(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
  // Title and nav link are unchanged and are not headings.
  await expect(page).toHaveTitle("Items - E2E PR App");
  await expect(page.getByTestId("nav-items")).toHaveText("Items");
});
