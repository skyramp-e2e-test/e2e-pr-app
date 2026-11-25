// Shared by the Items page browser tests: the seeded test account and signing in through /login.
import type { Page } from "@playwright/test";

/** The seeded account's email and password, read from the run's login variables. */
export function testAccount(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in as the seeded test user");
  }
  return { email, password };
}

/** Fills the Sign in form on the page that is open (/login) and submits it; the app redirects to /items. */
export async function submitSignIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/items$/);
}
