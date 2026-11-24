// Sign-in and Items page locators shared by the Items page browser tests.
import { expect, getBaseUrl } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";

export const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

/** The seeded test account, read from the run's login variables. */
export function uiLogin(): { username: string; password: string } {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in");
  }
  return { username, password };
}

export function itemsPage(page: Page) {
  return {
    heading: page.getByRole("heading", { level: 1 }),
    yourItemsHeading: page.getByRole("heading", { name: "Your items", exact: true }),
    oldItemsHeading: page.getByRole("heading", { name: "Items", exact: true }),
    navItems: page.getByTestId("nav-items"),
    userStatus: page.getByTestId("user-status"),
    newItemInput: page.getByLabel("New item"),
    addItemButton: page.getByRole("button", { name: "Add item" }),
    itemError: page.getByTestId("item-error"),
    items: page.getByTestId("item"),
  };
}

/** Signs in through /login and waits for the redirect to /items. */
export async function signIn(page: Page): Promise<void> {
  const { username, password } = uiLogin();
  await page.goto(`${baseUrl}/login`);
  await page.getByTestId("email-input").fill(username);
  await page.getByTestId("password-input").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
}
