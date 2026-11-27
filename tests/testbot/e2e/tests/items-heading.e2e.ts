// The Items page (/items) is headed "Your items": one level-1 heading, for signed-in and anonymous visitors.
import { test, expect, getBaseUrl, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import type { Page } from "@playwright/test";

const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

test.use({ viewport: { width: 1280, height: 900 } });

function credentials() {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in");
  }
  return { email, password };
}

async function signIn(page: Page) {
  const { email, password } = credentials();
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(`${baseUrl}/items`);
  await expect(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
}

test("signed-in Items page has one level-1 heading reading Your items", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await signIn(page);

  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByTestId("items-heading")).toHaveText("Your items");
  await expect(page.getByRole("heading", { level: 1, name: "Your items", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "My items", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Items", exact: true })).toHaveCount(0);
});

test("served Items page HTML has one h1 reading Your items", async ({ request }) => {
  const response = await request.get(`${baseUrl}/items`);
  expect(response.status()).toBe(200);
  const html = await response.text();
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1].trim());
  expect(headings).toEqual(["Your items"]);
});

test("anonymous visitor reaching Items from the nav sees Your items heading", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await page.goto(`${baseUrl}/`);
  await page.getByTestId("nav-items").click();
  await expect(page).toHaveURL(`${baseUrl}/items`);

  await expect.soft(page.getByTestId("user-status")).toHaveText("You are not signed in.");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByTestId("items-heading")).toHaveText("Your items");
});
