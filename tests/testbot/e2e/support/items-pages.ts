import type { Locator, Page } from "@playwright/test";

/** Reads a login variable the run or CI supplies; fails clearly when it is missing. */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: these tests sign in with the login the environment provides`);
  return value;
}

/** The /login page. */
export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly signIn: Locator;

  constructor(readonly page: Page) {
    this.email = page.getByLabel("Email");
    this.password = page.getByLabel("Password");
    this.signIn = page.getByRole("button", { name: "Sign in" });
  }

  async goto() {
    await this.page.goto("/login");
  }

  async signInAs(email: string, password: string) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.signIn.click();
  }
}

/** The /items page. */
export class ItemsPage {
  readonly mainHeading: Locator;
  readonly bareItemsHeading: Locator;
  readonly userStatus: Locator;
  readonly newItem: Locator;
  readonly addItem: Locator;
  readonly itemError: Locator;
  readonly itemsList: Locator;
  readonly items: Locator;
  readonly navHome: Locator;
  readonly navLogin: Locator;
  readonly navItems: Locator;
  readonly signOut: Locator;

  constructor(readonly page: Page) {
    this.mainHeading = page.getByRole("heading", { level: 1 });
    this.bareItemsHeading = page.getByRole("heading", { name: "Items", exact: true });
    this.userStatus = page.getByTestId("user-status");
    this.newItem = page.getByLabel("New item");
    this.addItem = page.getByRole("button", { name: "Add item" });
    this.itemError = page.getByTestId("item-error");
    this.itemsList = page.getByTestId("items-list");
    this.items = this.itemsList.getByTestId("item");
    this.navHome = page.getByTestId("nav-home");
    this.navLogin = page.getByTestId("nav-login");
    this.navItems = page.getByTestId("nav-items");
    this.signOut = page.getByTestId("logout-button");
  }

  async goto() {
    await this.page.goto("/items");
  }

  item(name: string): Locator {
    return this.items.filter({ hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) });
  }
}
