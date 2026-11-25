import { expect, type Page } from "@playwright/test";

/** The sign-in page (/login). */
export class LoginPage {
  constructor(private readonly page: Page) {}

  readonly email = () => this.page.getByLabel("Email");
  readonly password = () => this.page.getByLabel("Password");
  readonly signIn = () => this.page.getByRole("button", { name: "Sign in" });

  async goto() {
    await this.page.goto("/login");
    await expect(this.signIn()).toBeVisible();
  }

  /** Signs in with the run's browser login, read from the environment. */
  async signInAsTestUser() {
    await this.email().fill(testUserEmail());
    await this.password().fill(requiredEnv("SKYRAMP_UI_PASSWORD"));
    await this.signIn().click();
  }
}

export function testUserEmail(): string {
  return requiredEnv("SKYRAMP_UI_USERNAME");
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set to the seeded test user's login`);
  return value;
}
