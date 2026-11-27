import { test, expect, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { signIn } from "../support/sign-in";

test("signed-in user sees the Items page headed exactly Your items", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  await signIn(page);

  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveCount(1);
  await expect(heading).toHaveText("Your items");
  await expect(page.getByTestId("items-heading")).toHaveText("Your items");
  // The former heading text and the branch's "My items" are not shown.
  await expect(page.getByRole("heading", { level: 1, name: "Items", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "My items", exact: true })).toHaveCount(0);
});
