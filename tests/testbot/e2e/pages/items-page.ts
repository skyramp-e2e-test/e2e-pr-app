import type { Locator, Page } from "@playwright/test";

/** The Items page at /items. */
export class ItemsPage {
  readonly heading: Locator;
  readonly headingByTestId: Locator;
  readonly userStatus: Locator;
  readonly newItem: Locator;
  readonly addItem: Locator;
  readonly itemError: Locator;
  readonly items: Locator;

  constructor(readonly page: Page) {
    this.heading = page.getByRole("heading", { level: 1 });
    this.headingByTestId = page.getByTestId("items-heading");
    this.userStatus = page.getByTestId("user-status");
    this.newItem = page.getByLabel("New item");
    this.addItem = page.getByRole("button", { name: "Add item" });
    this.itemError = page.getByTestId("item-error");
    this.items = page.getByTestId("items-list").getByTestId("item");
  }

  item(name: string): Locator {
    return this.items.filter({ hasText: name });
  }
}
