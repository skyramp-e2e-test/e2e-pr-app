import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { baseUrl, expectItemsHeading, seededAccount, signIn } from "../support/items-app";

test.use({ viewport: { width: 1280, height: 900 } });

test("Items page main heading reads Your items, also after a reload", async ({ page }) => {
  page.setDefaultTimeout(15000);
  page = newSkyrampPlaywrightPage(page);
  const { email, password } = seededAccount();

  await test.step("sign in through /login and land on /items", async () => {
    await page.goto(`${baseUrl}/login`);
    await signIn(page, email, password);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  });

  await test.step("the Items page has one level-1 heading reading Your items", async () => {
    await expectItemsHeading(page);
  });

  await test.step("after reloading /items the heading still reads Your items", async () => {
    await page.goto(`${baseUrl}/items`);
    await expectItemsHeading(page);
  });
});
