'use strict';

// Runs against the running app (BASE_URL, default http://localhost:3000):
//   node --test tests/api/items-name-length.live.js
const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.SKYRAMP_TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';

async function listItems() {
  const res = await fetch(`${BASE_URL}/api/items`);
  assert.equal(res.status, 200);
  return res.json();
}

test('POST /api/items with a 51-character name is refused and the item list is unchanged', async () => {
  const name = 'x'.repeat(51);
  const before = await listItems();

  const res = await fetch(`${BASE_URL}/api/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'name is too long' });

  const after = await listItems();
  assert.equal(after.filter((item) => item.name === name).length, 0);
  const afterById = new Map(after.map((item) => [item.id, item]));
  for (const item of before) assert.deepEqual(afterById.get(item.id), item);
});
