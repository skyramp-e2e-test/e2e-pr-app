import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { signInThroughLoginForm } from "./items-signin";

test("Items page has one level-1 heading reading exactly Your items and none reading Items", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);

  await test.step("sign in at /login and land on /items", async () => {
    await page.goto("/login");
    await signInThroughLoginForm(page);
  });

  await test.step("the only h1 reads exactly Your items", async () => {
    const h1 = page.getByRole("heading", { level: 1 });
    await expect.soft(h1).toHaveCount(1);
    await expect.soft(h1).toHaveText("Your items", { useInnerText: true });
    await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
  });

  await test.step("no heading reads Items any more", async () => {
    await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
  });
});
