'use strict';

const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');

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

// Signs a value the way cookie-parser's signed cookies are signed
// (HMAC-SHA256, base64 without padding), as cookie-signature does.
function sign(value, secret) {
  const sig = crypto.createHmac('sha256', secret).update(value).digest('base64').replace(/=+$/, '');
  return `${value}.${sig}`;
}

function sessionCookie(signed) {
  return 'session=' + encodeURIComponent(`s:${signed}`);
}

test('GET /api/me without a session returns the reworded 401 message', async () => {
  await withServer(fakePool(), async (base) => {
    const res = await fetch(`${base}/api/me`);
    assert.equal(res.status, 401);
    assert.match(res.headers.get('content-type'), /^application\/json/);
    const body = await res.json();
    assert.deepEqual(body, { error: 'You are not signed in' });
    assert.notEqual(body.error, 'Not signed in');
  });
});

test('GET /api/me with an invalidly signed session cookie gets the same 401 as no cookie', async () => {
  await withServer(fakePool(), async (base) => {
    const noCookie = await fetch(`${base}/api/me`);
    assert.equal(noCookie.status, 401);
    const expected = await noCookie.json();
    assert.deepEqual(expected, { error: 'You are not signed in' });

    const valid = sign('a@b.c', 'test-only');
    const tampered = valid.slice(0, -1) + (valid.endsWith('A') ? 'B' : 'A');
    const cookies = {
      unsigned: 'session=test%40example.com',
      tampered: sessionCookie(tampered),
      otherSecret: sessionCookie(sign('a@b.c', 'other-secret')),
    };
    for (const [kind, cookie] of Object.entries(cookies)) {
      const res = await fetch(`${base}/api/me`, { headers: { cookie } });
      assert.equal(res.status, 401, `${kind} cookie status`);
      assert.deepEqual(await res.json(), expected, `${kind} cookie body`);
    }
  });
});

test('GET /api/me with a validly signed session cookie returns 200 and the email', async () => {
  await withServer(fakePool(), async (base) => {
    const res = await fetch(`${base}/api/me`, {
      headers: { cookie: sessionCookie(sign('test@example.com', 'test-only')) },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { email: 'test@example.com' });
  });
});
