import { expect, type Page } from "@playwright/test";

/** The items page (/items). */
export class ItemsPage {
  constructor(private readonly page: Page) {}

  readonly heading = () => this.page.getByRole("heading", { level: 1 });
  readonly headingNamed = (name: string) => this.page.getByRole("heading", { name, exact: true });
  readonly userStatus = () => this.page.getByTestId("user-status");
  readonly newItem = () => this.page.getByLabel("New item");
  readonly addItem = () => this.page.getByRole("button", { name: "Add item" });
  readonly error = () => this.page.getByTestId("item-error");
  readonly list = () => this.page.getByTestId("items-list");
  readonly items = () => this.list().getByTestId("item");
  readonly item = (name: string) => this.items().filter({ hasText: name });

  async goto() {
    await this.page.goto("/items");
    await this.waitForStatus();
  }

  /** The status line is filled in once the page's own /api/me call answers. */
  async waitForStatus() {
    await expect(this.userStatus()).not.toHaveText("");
  }
}
