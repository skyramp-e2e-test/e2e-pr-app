// Page object for the sign-in and Items pages, shared by the Items page tests.
import { expect, type Page, type Response } from "@playwright/test";
import { checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";

export type ApiItem = { id: number; name: string; created_at: string };

export const baseUrl = process.env.SKYRAMP_TEST_SERVICE_URL_UI || process.env.SKYRAMP_TEST_BASE_URL || "http://localhost:3000";

/** A suffix unique to this run, so item names made by a test are its own. */
export const uniqueSuffix = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const isItemsList = (r: Response) => new URL(r.url()).pathname === "/api/items" && r.request().method() === "GET";
const isItemCreate = (r: Response) => new URL(r.url()).pathname === "/api/items" && r.request().method() === "POST";

export class ItemsPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = newSkyrampPlaywrightPage(page);
    this.page.setDefaultTimeout(15000);
  }

  get email() { return this.page.getByLabel("Email"); }
  get password() { return this.page.getByLabel("Password"); }
  get signInButton() { return this.page.getByRole("button", { name: "Sign in" }); }
  get heading() { return this.page.getByRole("heading", { level: 1 }); }
  get userStatus() { return this.page.getByTestId("user-status"); }
  get list() { return this.page.getByTestId("items-list"); }
  get entries() { return this.list.getByTestId("item"); }
  get newItemInput() { return this.page.getByLabel("New item"); }
  get addItemButton() { return this.page.getByRole("button", { name: "Add item" }); }
  get error() { return this.page.getByTestId("item-error"); }

  /** Signs in with the run's login (SKYRAMP_UI_USERNAME / SKYRAMP_UI_PASSWORD) and waits for the Items page. */
  async signIn(): Promise<ApiItem[]> {
    const username = process.env.SKYRAMP_UI_USERNAME;
    const password = process.env.SKYRAMP_UI_PASSWORD;
    if (!username || !password) throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set");
    await this.page.goto(`${baseUrl}/login`);
    await this.email.fill(username);
    await this.password.fill(password);
    const loaded = this.page.waitForResponse(isItemsList);
    await this.signInButton.click();
    await expect(this.page).toHaveURL(/\/items$/);
    return (await loaded).json();
  }

  /** Opens /items and returns the GET /api/items answer the page rendered its list from. */
  async open(): Promise<ApiItem[]> {
    const loaded = this.page.waitForResponse(isItemsList);
    await this.page.goto(`${baseUrl}/items`);
    return (await loaded).json();
  }

  /** Reloads /items and returns the GET /api/items answer the page rendered its list from. */
  async reload(): Promise<ApiItem[]> {
    const loaded = this.page.waitForResponse(isItemsList);
    await this.page.reload();
    return (await loaded).json();
  }

  /**
   * Adds an item through the form, checking the POST body is exactly what was typed. Returns the created item
   * and the GET /api/items answer the page re-rendered its list from.
   */
  async addItem(typed: string): Promise<{ created: ApiItem; items: ApiItem[] }> {
    await this.newItemInput.fill(typed);
    await expect(this.newItemInput).toHaveValue(typed);
    const posted = this.page.waitForResponse(isItemCreate);
    const reloaded = this.page.waitForResponse(isItemsList);
    await this.addItemButton.click();
    const post = await posted;
    checkRequestPayload(post.request().postDataJSON(), { name: typed });
    expect(post.status()).toBe(201);
    const created: ApiItem = await post.json();
    const items: ApiItem[] = await (await reloaded).json();
    return { created, items };
  }

  /** Waits until the list shows one entry per item of the given API answer, and returns the entries' texts. */
  async entryTexts(items: ApiItem[]): Promise<string[]> {
    await expect(this.entries).toHaveCount(items.length);
    return this.entries.allTextContents();
  }
}
