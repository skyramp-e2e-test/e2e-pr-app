// Page objects for the login and Items pages, shared by the Items-page browser tests.
import type { Locator, Page } from "@playwright/test";

export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly signIn: Locator;

  constructor(private readonly page: Page) {
    this.email = page.getByTestId("email-input");
    this.password = page.getByTestId("password-input");
    this.signIn = page.getByRole("button", { name: "Sign in" });
  }

  async goto(): Promise<void> {
    await this.page.goto("/login");
  }

  /** Signs in with the run's UI login, read from the environment, and waits for the redirect to /items. */
  async signInAsTestUser(): Promise<string> {
    const username = process.env.SKYRAMP_UI_USERNAME;
    const password = process.env.SKYRAMP_UI_PASSWORD;
    if (!username || !password) {
      throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in");
    }
    await this.email.fill(username);
    await this.password.fill(password);
    await this.signIn.click();
    await this.page.waitForURL("**/items");
    return username;
  }
}

export class ItemsPage {
  readonly heading: Locator;
  readonly levelOneHeadings: Locator;
  readonly yourItemsHeading: Locator;
  readonly oldItemsHeading: Locator;
  readonly navItems: Locator;
  readonly navHome: Locator;
  readonly navLogin: Locator;
  readonly signOut: Locator;
  readonly userStatus: Locator;
  readonly newItem: Locator;
  readonly addItem: Locator;
  readonly itemError: Locator;
  readonly itemsList: Locator;
  readonly items: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByTestId("items-heading");
    this.levelOneHeadings = page.getByRole("heading", { level: 1 });
    this.yourItemsHeading = page.getByRole("heading", { name: "Your items", exact: true });
    this.oldItemsHeading = page.getByRole("heading", { name: "Items", exact: true });
    this.navItems = page.getByTestId("nav-items");
    this.navHome = page.getByTestId("nav-home");
    this.navLogin = page.getByTestId("nav-login");
    this.signOut = page.getByRole("button", { name: "Sign out" });
    this.userStatus = page.getByTestId("user-status");
    this.newItem = page.getByLabel("New item");
    this.addItem = page.getByRole("button", { name: "Add item" });
    this.itemError = page.getByTestId("item-error");
    this.itemsList = page.getByTestId("items-list");
    this.items = this.itemsList.getByTestId("item");
  }

  async goto(): Promise<void> {
    await this.page.goto("/items");
  }
}
