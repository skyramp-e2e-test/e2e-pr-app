import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { itemsPage, signIn } from "../support/items-app";

test.use({ viewport: { width: 1280, height: 900 } });

test("Items page main heading reads exactly 'Your items' and the old 'Items' heading is gone", async ({ page }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(15000);
  page = newSkyrampPlaywrightPage(page);

  await signIn(page);
  const items = itemsPage(page);

  await expect(items.heading).toHaveCount(1);
  await expect(items.heading).toHaveText("Your items");
  await expect(items.heading).toHaveText(["Your items"]);
  await expect(items.oldItemsHeading).toHaveCount(0);
  // The nav link keeps its "Items" label; only the heading changed.
  await expect(items.navItems).toBeVisible();
  await expect(items.navItems).toHaveText("Items");
});
