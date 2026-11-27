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

function postItem(base, name) {
  return fetch(`${base}/api/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

test('POST /api/items rejects a 51-character name with 400 and writes nothing', async () => {
  const pool = fakePool();
  await withServer(pool, async (base) => {
    const res = await postItem(base, 'a'.repeat(51));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /too long/i);
    assert.equal(pool.queries.length, 0);
  });
});

test('POST /api/items inserts a name of exactly 50 characters', async () => {
  const pool = fakePool([{ id: 1, name: 'b'.repeat(50), created_at: '2026-01-01T00:00:00Z' }]);
  await withServer(pool, async (base) => {
    const res = await postItem(base, 'b'.repeat(50));
    assert.equal(res.status, 201);
    assert.equal(pool.queries.length, 1);
    assert.deepEqual(pool.queries[0].params, ['b'.repeat(50)]);
  });
});

test('POST /api/items accepts 50 characters surrounded by whitespace, stored trimmed', async () => {
  const pool = fakePool([{ id: 1, name: 'c'.repeat(50), created_at: '2026-01-01T00:00:00Z' }]);
  await withServer(pool, async (base) => {
    const res = await postItem(base, '  ' + 'c'.repeat(50) + '  ');
    assert.equal(res.status, 201);
    assert.equal(pool.queries.length, 1);
    assert.deepEqual(pool.queries[0].params, ['c'.repeat(50)]);
  });
});

test('POST /api/items rejects 51 characters surrounded by whitespace and writes nothing', async () => {
  const pool = fakePool();
  await withServer(pool, async (base) => {
    const res = await postItem(base, ' ' + 'd'.repeat(51) + ' ');
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /too long/i);
    assert.equal(pool.queries.length, 0);
  });
});

test('POST /api/items rejects a 1000-character name and writes nothing', async () => {
  const pool = fakePool();
  await withServer(pool, async (base) => {
    const res = await postItem(base, 'x'.repeat(1000));
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
