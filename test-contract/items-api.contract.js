'use strict';

// Runs against the running app (not collected by `npm test`): node --test test-contract/
const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = (process.env.SKYRAMP_TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

async function itemNames() {
  const res = await fetch(`${BASE_URL}/api/items`);
  assert.equal(res.status, 200);
  return (await res.json()).map((item) => item.name);
}

test('POST /api/items on the running app rejects a 51-character name and does not list it', async () => {
  // 51 characters, unique to this run so it can be found afterwards.
  const name = 'a'.repeat(38) + String(Date.now()).padStart(13, '0');
  assert.equal(name.length, 51);

  const before = await itemNames();
  assert.equal(before.includes(name), false);

  const res = await fetch(`${BASE_URL}/api/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(typeof body.error, 'string');
  assert.ok(body.error.length > 0);

  const after = await itemNames();
  assert.equal(after.filter((n) => n === name).length, 0);
});
