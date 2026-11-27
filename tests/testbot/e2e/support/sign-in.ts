// Sign-in shared by the items-page browser tests.
import { expect, getBaseUrl } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";

export const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

export function loginCredentials(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through /login");
  }
  return { email, password };
}

// Signs in on /login and waits for the redirect to /items with the signed-in status shown.
export async function signIn(page: Page): Promise<string> {
  const { email, password } = loginCredentials();
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
  await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  return email;
}
