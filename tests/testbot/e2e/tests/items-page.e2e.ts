import { test, expect, checkRequestPayload, newSkyrampPlaywrightPage } from "@skyramp/skyramp";
import { signInThroughLoginForm } from "./items-signin";

// Items have no delete API: .skyramp/cleanup/delete-journey-items.sh removes the ones this test adds, by this prefix.
const ITEM_PREFIX = "Testbot journey item";

test("sign in, see the page headed Your items, add an item and see it kept after a reload", async ({ page }) => {
  page = newSkyrampPlaywrightPage(page);
  const itemName = `${ITEM_PREFIX} ${Date.now()}-${test.info().workerIndex}`;
  const heading = page.getByRole("heading", { level: 1 });
  const items = page.getByTestId("items-list").getByTestId("item");
  const input = page.getByLabel("New item");
  let email = "";
  let countBefore = 0;

  await test.step("1. sign in at /login and land on /items", async () => {
    await page.goto("/login");
    email = await signInThroughLoginForm(page);
  });

  await test.step("2. the page is headed Your items and shows who is signed in", async () => {
    await expect.soft(heading).toHaveCount(1);
    await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
    await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
  });

  await test.step("3. add an item; it is the last entry, the input clears, no error", async () => {
    const listed = (await (await page.request.get("/api/items")).json()) as Array<{ name: string }>;
    await expect(items).toHaveCount(listed.length);
    countBefore = listed.length;
    await input.fill(itemName);
    const post = page.waitForResponse((r) => r.url().endsWith("/api/items") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Add item" }).click();
    const response = await post;
    checkRequestPayload(response.request().postDataJSON(), { name: itemName });
    expect.soft(response.status()).toBe(201);
    await expect.soft(items.filter({ hasText: itemName })).toHaveCount(1);
    // Shown in id order: the list is what it was, with the new item appended as its last entry.
    await expect.soft(items).toHaveText([...listed.map((i) => i.name), itemName]);
    await expect.soft(input).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
    await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
  });

  await test.step("4. after a reload the heading, status and added item remain", async () => {
    await page.reload();
    await expect.soft(heading).toHaveCount(1);
    await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
    await expect.soft(page.getByRole("heading", { name: "Items", exact: true })).toHaveCount(0);
    await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    // The list shows every item in id order; this test's item is last unless a parallel test added one since.
    await expect.soft(items.filter({ hasText: itemName })).toHaveCount(1);
    const listed = (await (await page.request.get("/api/items")).json()) as Array<{ name: string }>;
    expect.soft(listed.length).toBeGreaterThanOrEqual(countBefore + 1);
    await expect.soft(items).toHaveText(listed.map((i) => i.name));
    await expect.soft(input).toHaveValue("");
    await expect.soft(page.getByTestId("item-error")).toBeHidden();
  });
});
