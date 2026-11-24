// Contract test of GET /items, the Items page HTML. Written by hand: Skyramp API generation was unavailable
// in this run (licence error). The route is public, so no cookie is sent.
import { test, expect, getBaseUrl } from '@skyramp/skyramp';

// URL for test requests
const baseUrl = getBaseUrl('SKYRAMP_TEST_BASE_URL', 'http://localhost:3000');

test('GET /items serves the page with the heading "Your items"', async ({ request }) => {
  const response = await request.get(`${baseUrl}/items`);

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^text\/html/);
  const body = await response.text();
  expect(body).toContain('<h1>Your items</h1>');
  expect(body).not.toContain('<h1>Items</h1>');
  expect(body.match(/<h1[\s>]/g)).toHaveLength(1);
});
