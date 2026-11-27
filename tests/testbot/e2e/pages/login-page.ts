import type { Locator, Page } from "@playwright/test";

/** The sign-in page at /login. */
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
    await this.page.goto("/login");
  }

  /** Signs in with the seeded test account the run provides (SKYRAMP_UI_USERNAME / SKYRAMP_UI_PASSWORD). */
  async signInAsTestUser(): Promise<string> {
    const username = process.env.SKYRAMP_UI_USERNAME;
    const password = process.env.SKYRAMP_UI_PASSWORD;
    if (!username || !password) {
      throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in");
    }
    await this.email.fill(username);
    await this.password.fill(password);
    await this.signIn.click();
    return username;
  }
}
