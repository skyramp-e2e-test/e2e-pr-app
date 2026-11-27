// The Items page is headed "Your items", signed in or not.
// Drafted with the Skyramp walk helper, then fitted to the support page objects.
import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { baseUrl, ItemsPage, LoginPage, uiLogin } from "../support/items-page";

test.use({ viewport: { width: 1280, height: 900 } });

test("signed in, the Items page has one h1 reading Your items", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = uiLogin();
  const login = new LoginPage(page);
  const items = new ItemsPage(page);

  await test.step("sign in at /login", async () => {
    await page.goto(`${baseUrl}/login`);
    await login.signIn(email, password);
    await expect(page).toHaveURL(`${baseUrl}/items`);
    await expect(items.userStatus).toHaveText(`Signed in as ${email}`);
  });

  await test.step("the heading reads Your items and is the only h1", async () => {
    await expect(items.heading).toHaveCount(1);
    await expect(items.heading).toHaveText("Your items");
    await expect(items.headingByTestId).toHaveText("Your items");
    await expect(items.oldHeading).toHaveCount(0);
  });
});

test("signed out, the Items page is still headed Your items", async ({ browser }) => {
  const context = await browser.newContext();
  try {
    expect(await context.cookies()).toEqual([]);
    const page = newSkyrampPlaywrightPage(await context.newPage());
    const items = new ItemsPage(page);
    await items.goto();

    await expect(items.userStatus).toHaveText("You are not signed in.");
    await expect(items.heading).toHaveCount(1);
    await expect(items.heading).toHaveText("Your items");
    await expect(items.headingByTestId).toHaveText("Your items");
    await expect(items.oldHeading).toHaveCount(0);
  } finally {
    await context.close();
  }
});
