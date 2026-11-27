import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { LoginPage } from "../pages/login-page";
import { ItemsPage } from "../pages/items-page";

test("signed-in user sees the Items page headed Your items", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const login = new LoginPage(page);
  const items = new ItemsPage(page);

  await test.step("sign in at /login", async () => {
    await login.goto();
    await login.signInAsTestUser();
    await expect(page).toHaveURL(/\/items$/);
  });

  await test.step("read the Items page main heading", async () => {
    await expect(items.heading).toHaveCount(1);
    await expect(items.heading).toHaveText("Your items");
    await expect(items.headingByTestId).toHaveText("Your items");
  });
});
