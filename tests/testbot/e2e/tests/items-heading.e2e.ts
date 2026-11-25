// The Items page (GET /items) is headed "Your items": signed in, signed out, and through the sign-in-and-add-item journey.
import { test, expect, type Page } from "@playwright/test";
import { checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";

const baseUrl = process.env.SKYRAMP_TEST_BASE_URL || process.env.SKYRAMP_TEST_SERVICE_URL_APP || "http://localhost:3000";

function credentials(): { email: string; password: string } {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in through /login");
  }
  return { email, password };
}

// Signs in from the home page through the nav Login link and the Sign in form; lands on /items.
async function signInFromHome(page: Page, email: string, password: string) {
  await page.goto(`${baseUrl}/`);
  await page.getByTestId("nav-login").click();
  await expect(page).toHaveURL(`${baseUrl}/login`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
}

test.describe("Items page heading", () => {
  test("signed in, the Items page has one h1 reading exactly Your items and no heading Items", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const { email, password } = credentials();
    await signInFromHome(page, email, password);

    const heading = page.getByTestId("items-heading");
    await expect(heading).toHaveText(/^Your items$/);
    await expect(heading).toHaveJSProperty("tagName", "H1");

    const h1s = page.getByRole("heading", { level: 1 });
    await expect(h1s).toHaveCount(1);
    await expect(h1s).toHaveText(/^Your items$/);
    await expect(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
    // The nav link keeps its "Items" label; it is not a heading.
    await expect(page.getByTestId("nav-items")).toHaveText("Items");
    await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  });

  test("signed out, the Items page is headed Your items and says You are not signed in.", async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = newSkyrampPlaywrightPage(await context.newPage());
      await page.goto(`${baseUrl}/items`);
      const heading = page.getByTestId("items-heading");
      await expect(heading).toHaveText(/^Your items$/);
      await expect(heading).toHaveJSProperty("tagName", "H1");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.getByTestId("user-status")).toHaveText("You are not signed in.");
    } finally {
      await context.close();
    }
  });

  test("sign in, see the Items page headed Your items, and add an item that stays after reload", async ({ page }) => {
    page = newSkyrampPlaywrightPage(page);
    const { email, password } = credentials();
    const itemName = `Walk item ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await test.step("1. / — click the Login nav link; the Sign in page is shown", async () => {
      await page.goto(`${baseUrl}/`);
      await page.getByTestId("nav-login").click();
      await expect.soft(page).toHaveURL(`${baseUrl}/login`);
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
    });

    await test.step("2. /login — fill Email and Password, click Sign in; redirected to /items", async () => {
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL(`${baseUrl}/items`);
    });

    await test.step("3. /items — the only h1 reads Your items; status shows the signed-in user", async () => {
      await expect.soft(page.getByTestId("items-heading")).toHaveText(/^Your items$/);
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveText(/^Your items$/);
      await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
      await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    });

    await test.step("4. /items — add a new item; input clears, no error, the new item is the last row", async () => {
      await page.getByLabel("New item").fill(itemName);
      const responsePromise = page.waitForResponse(
        (r) => r.url().endsWith("/api/items") && r.request().method() === "POST"
      );
      await page.getByRole("button", { name: "Add item" }).click();
      const response = await responsePromise;
      checkRequestPayload(response.request().postDataJSON(), { name: itemName });
      expect.soft(response.status()).toBe(201);
      await expect.soft(page.getByLabel("New item")).toHaveValue("");
      await expect.soft(page.getByTestId("item-error")).toBeHidden();
      await expect.soft(page.getByTestId("items-list").getByText(itemName, { exact: true })).toHaveCount(1);
      // The order is what this checks: the new item's name is the list's last row.
      await expect
        .configure({ soft: true })
        .poll(async () => (await page.getByTestId("items-list").getByTestId("item").allTextContents()).at(-1))
        .toBe(itemName);
    });

    await test.step("5. /items — reload; heading still Your items and the new item is still the last row", async () => {
      await page.reload();
      await expect.soft(page).toHaveURL(`${baseUrl}/items`);
      await expect.soft(page.getByTestId("items-heading")).toHaveText(/^Your items$/);
      await expect.soft(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
      await expect.soft(page.getByTestId("item-error")).toBeHidden();
      await expect.soft(page.getByLabel("New item")).toHaveValue("");
      await expect.soft(page.getByTestId("items-list").getByText(itemName, { exact: true })).toHaveCount(1);
      // The item was saved once: read it back from the API the page loads its list from.
      const stored = (await (await page.request.get(`${baseUrl}/api/items`)).json()) as { name: string }[];
      expect.soft(stored.filter((i) => i.name === itemName)).toHaveLength(1);
      // The order is what this checks: the new item's name is the list's last row.
      await expect
        .configure({ soft: true })
        .poll(async () => (await page.getByTestId("items-list").getByTestId("item").allTextContents()).at(-1))
        .toBe(itemName);
    });
  });
});
