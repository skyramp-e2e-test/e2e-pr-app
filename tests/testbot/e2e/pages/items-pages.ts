// Page objects for the login and Items pages, and the item helpers the Items page tests share.
import { expect, type APIRequestContext, type Locator, type Page, type Response } from "@playwright/test";

export const baseUrl =
  process.env.SKYRAMP_TEST_SERVICE_URL_UI || process.env.SKYRAMP_TEST_BASE_URL || "http://localhost:3000";
export const apiUrl = process.env.SKYRAMP_TEST_BASE_URL || "http://localhost:3000";

export type StoredItem = { id: number; name: string; created_at: string };

/** A name no earlier run has used, so the test can find the item it made by the name it sent. */
export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

/** Creates an item through POST /api/items and checks the app stored it under that name. */
export async function createItem(request: APIRequestContext, name: string): Promise<StoredItem> {
  const res = await request.post(`${apiUrl}/api/items`, { data: { name } });
  expect(res.status()).toBe(201);
  const item = (await res.json()) as StoredItem;
  expect(item.name).toBe(name);
  return item;
}

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

  async signInAs(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.signIn.click();
  }
}

export class ItemsPage {
  readonly userStatus: Locator;
  readonly list: Locator;
  readonly entries: Locator;
  readonly newItem: Locator;
  readonly addItem: Locator;
  readonly error: Locator;

  constructor(readonly page: Page) {
    this.userStatus = page.getByTestId("user-status");
    this.list = page.getByTestId("items-list");
    this.entries = page.getByTestId("item");
    this.newItem = page.getByLabel("New item");
    this.addItem = page.getByRole("button", { name: "Add item" });
    this.error = page.getByTestId("item-error");
  }

  /** The page's own GET /api/items, which loadItems renders the list from. */
  waitForItemsLoad(): Promise<Response> {
    return this.page.waitForResponse(
      (r) => r.request().method() === "GET" && new URL(r.url()).pathname === "/api/items",
    );
  }

  /** Opens /items and returns the items the page loaded, in the order the API returned them. */
  async open(): Promise<StoredItem[]> {
    const loaded = this.waitForItemsLoad();
    await this.page.goto(`${baseUrl}/items`);
    return (await (await loaded).json()) as StoredItem[];
  }

  /** Reloads /items and returns the items the page loaded. */
  async reload(): Promise<StoredItem[]> {
    const loaded = this.waitForItemsLoad();
    await this.page.reload();
    return (await (await loaded).json()) as StoredItem[];
  }

  /** Entry for one item, found by its exact name. */
  entry(name: string): Locator {
    return this.list.getByTestId("item").filter({ hasText: new RegExp(`^${escapeRegExp(name)}$`) });
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
