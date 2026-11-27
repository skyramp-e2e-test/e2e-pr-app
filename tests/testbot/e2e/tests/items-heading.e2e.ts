// Items page heading: the page reads "Your items" after sign-in, and keeps it while the user adds an item.
// Drafted with the Skyramp walk helper, then strengthened by hand.
import { test, checkRequestPayload, expect, getBaseUrl, newSkyrampPlaywrightPage } from '@skyramp/skyramp';
import type { Page } from '@playwright/test';

const pageTimeout = 15000;

const baseUrl = getBaseUrl("SKYRAMP_TEST_BASE_URL", "http://localhost:3000");

test.use({
    viewport: { width: 1280, height: 900 },
});

function loginCredentials(): { email: string; password: string } {
    const email = process.env.SKYRAMP_UI_USERNAME;
    const password = process.env.SKYRAMP_UI_PASSWORD;
    if (!email || !password) {
        throw new Error("SKYRAMP_UI_USERNAME and SKYRAMP_UI_PASSWORD must be set: these tests sign in as the seeded user");
    }
    return { email, password };
}

async function signIn(page: Page, email: string, password: string) {
    await page.goto(`${baseUrl}/login`);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/items$/);
}

// The order of the list is what the journey checks: the item just added is its last entry.
async function itemNames(page: Page): Promise<string[]> {
    return page.getByTestId("items-list").getByTestId("item").allTextContents();
}

test('signed-in user sees the Items page headed "Your items"', async ({ page }) => {
    page.setDefaultTimeout(pageTimeout);
    page = newSkyrampPlaywrightPage(page);
    const { email, password } = loginCredentials();

    await signIn(page, email, password);
    await expect(page).toHaveURL(/\/items$/);

    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText("Your items");
    await expect(page.getByTestId("items-heading")).toHaveText("Your items");
    await expect(page.getByRole("heading", { level: 1, name: "Items", exact: true })).toHaveCount(0);
});

test('sign in, land on "Your items", add an item and still see it after a reload', async ({ page }) => {
    test.setTimeout(60000);
    page.setDefaultTimeout(pageTimeout);
    page = newSkyrampPlaywrightPage(page);
    const { email, password } = loginCredentials();
    const name = `journey-item-${Date.now()}`;

    await test.step("1. sign in on /login and land on /items", async () => {
        await signIn(page, email, password);
        await expect.soft(page).toHaveURL(/\/items$/);
    });

    await test.step('2. the page heading reads "Your items"', async () => {
        const h1 = page.getByRole("heading", { level: 1 });
        await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
        await expect.soft(h1).toHaveCount(1);
        await expect.soft(h1).toHaveText("Your items");
        await expect.soft(page.getByRole("heading", { level: 1, name: "Items", exact: true })).toHaveCount(0);
        await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
    });

    await test.step("3. add an item", async () => {
        await page.getByLabel("New item").fill(name);
        const postPromise = page.waitForResponse(
            (r) => r.url().endsWith("/api/items") && r.request().method() === "POST",
        );
        await page.getByRole("button", { name: "Add item" }).click();
        const post = await postPromise;
        checkRequestPayload(post.request().postDataJSON(), { name });
        expect.soft(post.status()).toBe(201);
        await expect.soft(page.getByTestId("item").filter({ hasText: name })).toHaveText(name);
        await expect.soft.poll(() => itemNames(page)).toEqual(expect.arrayContaining([name]));
        await expect.soft.poll(async () => (await itemNames(page)).at(-1)).toBe(name);
        await expect.soft(page.getByLabel("New item")).toHaveValue("");
        await expect.soft(page.getByTestId("item-error")).toBeHidden();
    });

    await test.step('4. reload the page: still "Your items" and the added item is listed once', async () => {
        await page.reload();
        const h1 = page.getByRole("heading", { level: 1 });
        await expect.soft(page.getByTestId("items-heading")).toHaveText("Your items");
        await expect.soft(h1).toHaveCount(1);
        await expect.soft(h1).toHaveText("Your items");
        await expect.soft(page.getByRole("heading", { level: 1, name: "Items", exact: true })).toHaveCount(0);
        await expect.soft(page.getByTestId("user-status")).toHaveText(`Signed in as ${email}`);
        await expect.soft(page.getByTestId("item").filter({ hasText: name })).toHaveCount(1);
        await expect.soft.poll(() => itemNames(page)).toEqual(expect.arrayContaining([name]));
        await expect.soft.poll(async () => (await itemNames(page)).at(-1)).toBe(name);
        await expect.soft(page.getByLabel("New item")).toHaveValue("");
        await expect.soft(page.getByTestId("item-error")).toBeHidden();
    });
});
