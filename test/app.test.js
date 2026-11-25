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

test('GET /api/me without a session returns 401', async () => {
  await withServer(fakePool(), async (base) => {
    const res = await fetch(`${base}/api/me`);
    assert.equal(res.status, 401);
  });
});

async function postItem(base, name) {
  return fetch(`${base}/api/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

test('POST /api/items rejects a 51-character name with 400 and writes nothing', async () => {
  for (const name of ['a'.repeat(51), 'a b'.repeat(17)]) {
    assert.equal(name.length, 51);
    const pool = fakePool();
    await withServer(pool, async (base) => {
      const res = await postItem(base, name);
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(typeof body.error, 'string');
      assert.match(body.error, /long|50|length/i);
      assert.notEqual(body.error, 'name is required');
      assert.equal(pool.queries.length, 0);
    });
  }
});

test('POST /api/items creates an item whose name is exactly 50 characters', async () => {
  const name = 'a'.repeat(50);
  const pool = fakePool([{ id: 1, name, created_at: '2026-01-01T00:00:00Z' }]);
  await withServer(pool, async (base) => {
    const res = await postItem(base, name);
    assert.equal(res.status, 201);
    assert.equal((await res.json()).name, name);
    assert.equal(pool.queries.length, 1);
    assert.deepEqual(pool.queries[0].params, [name]);
  });
});

test('POST /api/items applies the 50-character limit to the trimmed name', async () => {
  const fifty = 'a'.repeat(50);
  const accepted = fakePool([{ id: 1, name: fifty, created_at: '2026-01-01T00:00:00Z' }]);
  await withServer(accepted, async (base) => {
    const res = await postItem(base, `   ${fifty}   `);
    assert.equal(res.status, 201);
    assert.equal(accepted.queries.length, 1);
    assert.deepEqual(accepted.queries[0].params, [fifty]);
  });

  const rejected = fakePool();
  await withServer(rejected, async (base) => {
    const res = await postItem(base, `   ${'a'.repeat(51)}   `);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /long|50|length/i);
    assert.notEqual(body.error, 'name is required');
    assert.equal(rejected.queries.length, 0);
  });
});

test('POST /api/items rejects a 10000-character name before reaching the database', async () => {
  const pool = fakePool();
  await withServer(pool, async (base) => {
    const res = await postItem(base, 'a'.repeat(10000));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.error, /long|50|length/i);
    assert.notEqual(body.error, 'name is required');
    assert.equal(pool.queries.length, 0);
  });
});
