// Page objects for the sign-in and Items pages, shared by the Items-page browser tests.
import { expect, type Locator, type Page } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";

export const baseUrl = process.env.SKYRAMP_TEST_BASE_URL || "http://localhost:3000";

/** Name prefix of the items these tests add; .skyramp/cleanup/delete-heading-test-items.sh removes them. */
export const uniqueItemName = (): string =>
  `Heading check ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Wraps the Playwright page with the Skyramp page, as Skyramp's generated tests do. */
export const skyrampPage = (page: Page): Page => newSkyrampPlaywrightPage(page) as Page;

export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly signIn: Locator;

  constructor(readonly page: Page) {
    this.email = page.getByLabel("Email");
    this.password = page.getByLabel("Password");
    this.signIn = page.getByRole("button", { name: "Sign in" });
  }

  async goto(): Promise<void> {
    await this.page.goto(`${baseUrl}/login`);
  }

  /** Signs in with the run's UI login and waits for the redirect to /items. */
  async signInAsTestUser(): Promise<void> {
    const username = process.env.SKYRAMP_UI_USERNAME;
    const password = process.env.SKYRAMP_UI_PASSWORD;
    if (!username || !password) {
      throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in");
    }
    await this.email.fill(username);
    await this.password.fill(password);
    await this.signIn.click();
    await expect(this.page).toHaveURL(`${baseUrl}/items`);
  }
}

export class ItemsPage {
  readonly heading: Locator;
  readonly oldHeading: Locator;
  readonly navItems: Locator;
  readonly userStatus: Locator;
  readonly newItemInput: Locator;
  readonly addItemButton: Locator;
  readonly itemError: Locator;
  readonly items: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1 });
    this.oldHeading = page.getByRole("heading", { name: "Items", exact: true });
    this.navItems = page.getByTestId("nav-items");
    this.userStatus = page.getByTestId("user-status");
    this.newItemInput = page.getByLabel("New item");
    this.addItemButton = page.getByRole("button", { name: "Add item" });
    this.itemError = page.getByTestId("item-error");
    this.items = page.getByTestId("item");
  }

  async goto(): Promise<void> {
    await this.page.goto(`${baseUrl}/items`);
  }

  /** The list entry whose text is exactly `name`. */
  item(name: string): Locator {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return this.items.filter({ hasText: new RegExp(`^${escaped}$`) });
  }

  /** Resolves with the items the page's GET /api/items returns; start it before the navigation that loads the list. */
  async waitForList(): Promise<Array<{ name: string }>> {
    const response = await this.page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/items" && r.request().method() === "GET",
    );
    return response.json();
  }

  async itemNames(): Promise<string[]> {
    return this.items.allTextContents();
  }
}
