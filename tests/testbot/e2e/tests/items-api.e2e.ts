// POST /api/items against the running app: names over 50 characters are refused and not stored.
import { test, expect } from "@playwright/test";

const baseUrl = process.env.SKYRAMP_TEST_BASE_URL || process.env.SKYRAMP_TEST_SERVICE_URL_APP || "http://localhost:3000";

test("POST /api/items refuses a 51-character name and does not store it", async ({ request }) => {
  const name = `tbe2e-api-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.padEnd(51, "z").slice(0, 51);
  expect(name).toHaveLength(51);

  const res = await request.post(`${baseUrl}/api/items`, {
    headers: { "Content-Type": "application/json" },
    data: { name },
  });
  expect.soft(res.status()).toBe(400);
  const body = await res.json();
  expect.soft(typeof body.error).toBe("string");
  expect.soft(body.error).toMatch(/too long/i);

  const list = await request.get(`${baseUrl}/api/items`);
  expect(list.status()).toBe(200);
  const items: Array<{ name: string }> = await list.json();
  expect(items.filter((item) => item.name === name)).toHaveLength(0);
});
