'use strict';

// Contract tests for GET /api/items/count against the running app and its database.
// Run with: node --test e2e/
const test = require('node:test');
const assert = require('node:assert/strict');

const BASE_URL = process.env.SKYRAMP_TEST_BASE_URL || 'http://localhost:3000';

async function getJson(path, headers = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  const body = await res.json();
  return { res, body };
}

async function getCount(headers) {
  const { res, body } = await getJson('/api/items/count', headers);
  assert.equal(res.status, 200);
  return body.count;
}

function postItem(name) {
  return fetch(`${BASE_URL}/api/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

// Signs in with the login form and returns the session cookie (name=value).
async function signIn() {
  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      email: process.env.SKYRAMP_UI_USERNAME,
      password: process.env.SKYRAMP_UI_PASSWORD,
    }),
    redirect: 'manual',
  });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/items');
  const cookie = res.headers
    .getSetCookie()
    .find((c) => c.startsWith('session='));
  assert.ok(cookie, 'sign-in returned no session cookie');
  return cookie.split(';')[0];
}

test('GET /api/items/count answers 200 with {count} equal to the number of listed items', async () => {
  // Make sure at least one item is stored.
  const created = await postItem(`count-probe-${Date.now()}-list`);
  assert.equal(created.status, 201);

  const list = await getJson('/api/items');
  assert.equal(list.res.status, 200);
  const { res, body } = await getJson('/api/items/count');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(Object.keys(body), ['count']);
  assert.equal(typeof body.count, 'number');
  assert.ok(Number.isInteger(body.count), `count is not an integer: ${body.count}`);
  assert.equal(body.count, list.body.length);
});

test('creating an item raises the count by exactly one and a refused create does not', async () => {
  const c0 = await getCount();

  const created = await postItem(`count-probe-${Date.now()}`);
  assert.equal(created.status, 201);

  const c1 = await getCount();
  assert.equal(c1, c0 + 1);
  const list = await getJson('/api/items');
  assert.equal(list.body.length, c1);

  const refused = await postItem('   ');
  assert.equal(refused.status, 400);
  const c2 = await getCount();
  assert.equal(c2, c1);
});

test('GET /api/items/count answers without a session', async () => {
  const { res, body } = await getJson('/api/items/count');
  assert.equal(res.status, 200);
  assert.ok(Number.isInteger(body.count), `count is not an integer: ${body.count}`);
  const list = await getJson('/api/items');
  assert.equal(body.count, list.body.length);
});

test('GET /api/items/count answers the same count with a session as without one', async () => {
  const cookie = await signIn();
  const withoutSession = await getJson('/api/items/count');
  const withSession = await getJson('/api/items/count', { cookie });
  assert.equal(withSession.res.status, 200);
  assert.ok(Number.isInteger(withSession.body.count));
  assert.equal(withSession.body.count, withoutSession.body.count);
});
