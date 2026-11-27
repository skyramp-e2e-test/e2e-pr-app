// Drafted with the Skyramp walk helper, then strengthened.
import { test, expect } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { loginFromEnv, signInThroughLoginPage } from "../support/sign-in";

test("Items page has a single h1 reading exactly Your items", async ({ page }) => {
  test.setTimeout(30000);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = loginFromEnv();

  await signInThroughLoginPage(page, email, password);

  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(page.getByTestId("items-heading")).toHaveText("Your items", { useInnerText: true });
  await expect(h1).toHaveText(/^Your items$/);
  // The old heading is gone.
  await expect(page.getByRole("heading", { level: 1, name: "Items", exact: true })).toHaveCount(0);
});
