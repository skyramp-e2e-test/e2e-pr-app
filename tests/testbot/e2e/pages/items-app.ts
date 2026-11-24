// Page objects for the sign-in page (/login) and the Items page (/items).
import { expect, type Locator, type Page } from "@playwright/test";

export const baseUrl =
  process.env.SKYRAMP_TEST_SERVICE_URL_UI || process.env.SKYRAMP_TEST_BASE_URL || "http://localhost:3000";

/** The browser login the run supplies, read from the environment by name. */
export function uiCredentials(): { username: string; password: string } {
  const username = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!username || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through /login");
  }
  return { username, password };
}

export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly signIn: Locator;

  constructor(private readonly page: Page) {
    this.email = page.getByLabel("Email");
    this.password = page.getByLabel("Password");
    this.signIn = page.getByRole("button", { name: "Sign in" });
  }

  async goto(): Promise<void> {
    await this.page.goto(`${baseUrl}/login`);
  }

  async signInAs(username: string, password: string): Promise<void> {
    await this.email.fill(username);
    await this.password.fill(password);
    await this.signIn.click();
    await this.page.waitForURL(/\/items$/);
  }
}

export class ItemsPage {
  readonly mainHeadings: Locator;
  readonly userStatus: Locator;
  readonly newItem: Locator;
  readonly addItem: Locator;
  readonly items: Locator;
  readonly itemError: Locator;

  constructor(private readonly page: Page) {
    this.mainHeadings = page.getByRole("heading", { level: 1 });
    this.userStatus = page.getByTestId("user-status");
    this.newItem = page.getByLabel("New item");
    this.addItem = page.getByRole("button", { name: "Add item" });
    this.items = page.getByTestId("item");
    this.itemError = page.getByTestId("item-error");
  }

  /** A heading whose accessible name is exactly `name`. */
  heading(name: string): Locator {
    return this.page.getByRole("heading", { name, exact: true });
  }

  async goto(): Promise<void> {
    await this.page.goto(`${baseUrl}/items`);
  }

  /** The names in the items list, once the page has loaded them from /api/items. */
  async loadedItemNames(): Promise<string[]> {
    const response = await this.page.request.get(`${baseUrl}/api/items`);
    const expected = ((await response.json()) as { name: string }[]).map((i) => i.name);
    await expect(this.items).toHaveCount(expected.length);
    return this.items.allTextContents();
  }
}
