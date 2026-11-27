import { expect, type Page } from "@playwright/test";

// Signs in as the app's seeded test user through the Login page, from a page showing the nav
// (the caller opens it). Credentials come from the run's login variables, never from this file.
export async function signInFromHome(page: Page): Promise<void> {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in");
  }
  await page.getByTestId("nav-login").click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/items$/);
}

export function signedInStatus(): string {
  return `Signed in as ${process.env.SKYRAMP_UI_USERNAME}`;
}
