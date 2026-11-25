// Shared pieces for the Items app browser tests: the app address, the seeded
// account (from the run's environment) and the sign-in form on /login.
import { expect, type Page } from "@playwright/test";

export const baseUrl =
  process.env.SKYRAMP_TEST_SERVICE_URL_UI || process.env.SKYRAMP_TEST_BASE_URL || "http://localhost:3000";

export function seededAccount(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to the seeded user's sign-in");
  }
  return { email, password };
}

// Fills the /login form and submits it; resolves once the browser is on /items.
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
}

// The Items page's main heading: exactly one level-1 heading, reading exactly "Your items".
export async function expectItemsHeading(page: Page): Promise<void> {
  await expect.soft(page.getByRole("heading", { name: "Your items", exact: true })).toBeVisible();
  const h1 = page.getByRole("heading", { level: 1 });
  await expect.soft(h1).toHaveCount(1);
  await expect.soft(h1).toHaveText("Your items");
  await expect.soft(page.getByRole("heading", { level: 1, name: "Items", exact: true })).toHaveCount(0);
}
