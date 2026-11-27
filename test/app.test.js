'use strict';

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

function postItemJson(base, body) {
  return fetch(`${base}/api/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('POST /api/items rejects a 51-character name as too long and writes nothing', async () => {
  const pool = fakePool();
  await withServer(pool, async (base) => {
    const res = await postItemJson(base, { name: 'a'.repeat(51) });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /too long/i);
    assert.equal(pool.queries.length, 0);
  });
});

test('POST /api/items rejects a 5000-character name as too long and writes nothing', async () => {
  const pool = fakePool();
  await withServer(pool, async (base) => {
    const res = await postItemJson(base, { name: 'x'.repeat(5000) });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /too long/i);
    assert.equal(pool.queries.length, 0);
  });
});

test('POST /api/items creates an item whose name is exactly 50 characters', async () => {
  const name = 'a'.repeat(50);
  const pool = fakePool([{ id: 1, name, created_at: '2026-01-01T00:00:00Z' }]);
  await withServer(pool, async (base) => {
    const res = await postItemJson(base, { name });
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { id: 1, name, created_at: '2026-01-01T00:00:00Z' });
    assert.equal(pool.queries.length, 1);
    assert.deepEqual(pool.queries[0].params, [name]);
  });
});

test('POST /api/items measures the length after trimming surrounding whitespace', async () => {
  const name = 'b'.repeat(50);
  const pool = fakePool([{ id: 1, name, created_at: '2026-01-01T00:00:00Z' }]);
  await withServer(pool, async (base) => {
    const res = await postItemJson(base, { name: `  ${name}   ` });
    assert.equal(res.status, 201);
    assert.equal((await res.json()).name, name);
    assert.equal(pool.queries.length, 1);
    assert.deepEqual(pool.queries[0].params, [name]);
  });
});

test('POST /api/items counts inner spaces toward the 50-character limit', async () => {
  const pool = fakePool();
  const name = 'a '.repeat(25) + 'b';
  assert.equal(name.length, 51);
  await withServer(pool, async (base) => {
    const res = await postItemJson(base, { name });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /too long/i);
    assert.equal(pool.queries.length, 0);
  });
});

test('POST /api/items rejects a 51-character urlencoded name as too long', async () => {
  const pool = fakePool();
  await withServer(pool, async (base) => {
    const res = await fetch(`${base}/api/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `name=${'a'.repeat(51)}`,
    });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /too long/i);
    assert.equal(pool.queries.length, 0);
  });
});

test('GET /api/me without a session returns 401', async () => {
  await withServer(fakePool(), async (base) => {
    const res = await fetch(`${base}/api/me`);
    assert.equal(res.status, 401);
  });
});
