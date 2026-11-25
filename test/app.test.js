'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { hashPassword } = require('../src/passwords');

// Stand-in for the pg pool: records queries and returns the given rows.
function fakePool(rows = []) {
  const queries = [];
  return {
    queries,
    query: async (sql, params) => {
      queries.push({ sql, params });
      return { rows };
    },
  };
}

async function withServer(pool, fn) {
  const server = createApp({ pool, signingSecret: 'test-only' }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('GET /health returns 200', async () => {
  await withServer(fakePool(), async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });
});

test('POST /api/items without a name returns 400 and writes nothing', async () => {
  const pool = fakePool();
  await withServer(pool, async (base) => {
    const res = await fetch(`${base}/api/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    });
    assert.equal(res.status, 400);
    assert.equal(pool.queries.length, 0);
  });
});

test('POST /api/items creates an item with the trimmed name', async () => {
  const pool = fakePool([{ id: 1, name: 'Milk', created_at: '2026-01-01T00:00:00Z' }]);
  await withServer(pool, async (base) => {
    const res = await fetch(`${base}/api/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '  Milk ' }),
    });
    assert.equal(res.status, 201);
    assert.equal((await res.json()).name, 'Milk');
    assert.deepEqual(pool.queries[0].params, ['Milk']);
  });
});

test('GET /api/me without a session returns 401', async () => {
  await withServer(fakePool(), async (base) => {
    const res = await fetch(`${base}/api/me`);
    assert.equal(res.status, 401);
  });
});

test('GET /api/me without a session answers 401 with the reworded JSON error and no email', async () => {
  await withServer(fakePool(), async (base) => {
    const res = await fetch(`${base}/api/me`);
    assert.equal(res.status, 401);
    assert.match(res.headers.get('content-type'), /^application\/json/);
    const body = await res.json();
    assert.deepEqual(Object.keys(body), ['error']);
    assert.equal(typeof body.error, 'string');
    assert.notEqual(body.error.trim(), '');
    assert.notEqual(body.error, 'Not signed in');
    assert.equal('email' in body, false);
  });
});

test('GET /api/me with a tampered or unsigned session cookie answers the same 401 as no cookie', async () => {
  await withServer(fakePool(), async (base) => {
    const noCookie = await fetch(`${base}/api/me`);
    const noCookieBody = await noCookie.json();
    for (const cookie of [
      'session=s%3Aattacker%40example.com.badsignature',
      'session=attacker%40example.com',
    ]) {
      const res = await fetch(`${base}/api/me`, { headers: { cookie } });
      assert.equal(res.status, 401, cookie);
      const body = await res.json();
      assert.deepEqual(body, noCookieBody, cookie);
      assert.equal('email' in body, false, cookie);
    }
    assert.equal(noCookie.status, 401);
    assert.notEqual(noCookieBody.error, 'Not signed in');
  });
});

test('GET /api/me with a signed session from POST /login answers 200 with the email', async () => {
  const pool = fakePool([{ email: 'user@example.com', password_hash: hashPassword('pw') }]);
  await withServer(pool, async (base) => {
    const login = await fetch(`${base}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ email: 'user@example.com', password: 'pw' }),
      redirect: 'manual',
    });
    assert.equal(login.status, 303);
    assert.equal(login.headers.get('location'), '/items');
    const sessionCookie = login.headers.get('set-cookie').split(';')[0];
    assert.match(sessionCookie, /^session=s%3A/);

    const res = await fetch(`${base}/api/me`, { headers: { cookie: sessionCookie } });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { email: 'user@example.com' });
  });
});
