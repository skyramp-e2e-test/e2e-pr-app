// The Items page (/items) shows its main heading as "Your items" instead of "Items".
import { test, expect, type Page } from "@playwright/test";
import { newSkyrampPlaywrightPage } from "@skyramp/skyramp";

const baseUrl = process.env.SKYRAMP_TEST_BASE_URL || "http://localhost:3000";

async function signIn(page: Page) {
  const email = process.env.SKYRAMP_UI_USERNAME;
  const password = process.env.SKYRAMP_UI_PASSWORD;
  if (!email || !password) {
    throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set to sign in");
  }
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(`${baseUrl}/items`);
}

test("signed-in user sees the Items page heading read Your items", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await signIn(page);

  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveCount(1);
  await expect(h1).toHaveText("Your items", { useInnerText: true });
  await expect(page.getByRole("heading", { name: "Your items", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
});

test("Items page HTML at /items and /static/items.html has one h1 reading Your items", async ({ request }) => {
  for (const path of ["/items", "/static/items.html"]) {
    await test.step(`GET ${path}`, async () => {
      const res = await request.get(`${baseUrl}${path}`);
      expect(res.status()).toBe(200);
      const h1s = [...(await res.text()).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => m[1]);
      expect(h1s).toEqual(["Your items"]);
    });
  }
});
