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

async function assertNameTooLong(res, pool) {
  assert.equal(res.status, 400);
  const { error } = await res.json();
  assert.equal(typeof error, 'string');
  assert.notEqual(error, 'name is required');
  assert.match(error, /too long/i);
  assert.equal(pool.queries.length, 0);
}

async function assertCreated(name) {
  const pool = fakePool([{ id: 1, name, created_at: '2026-01-01T00:00:00Z' }]);
  await withServer(pool, async (base) => {
    const res = await postItem(base, name);
    assert.equal(res.status, 201, `expected 201 for a ${[...name].length}-character name`);
    assert.equal((await res.json()).name, name);
    assert.equal(pool.queries.length, 1);
    assert.deepEqual(pool.queries[0].params, [name]);
  });
}

test('POST /api/items rejects a 51-character name as too long and writes nothing', async () => {
  const pool = fakePool();
  await withServer(pool, async (base) => {
    await assertNameTooLong(await postItem(base, 'a'.repeat(51)), pool);
  });
});

test('POST /api/items rejects a 1000-character name as too long and writes nothing', async () => {
  const pool = fakePool();
  await withServer(pool, async (base) => {
    await assertNameTooLong(await postItem(base, 'a'.repeat(1000)), pool);
  });
});

test('POST /api/items creates an item whose name is exactly 50 characters', async () => {
  await assertCreated('a'.repeat(50));
});

test('POST /api/items applies the 50-character limit to the trimmed name', async () => {
  const accepted = fakePool([{ id: 1, name: 'a'.repeat(50), created_at: '2026-01-01T00:00:00Z' }]);
  await withServer(accepted, async (base) => {
    const res = await postItem(base, '  ' + 'a'.repeat(50) + '  ');
    assert.equal(res.status, 201);
    assert.deepEqual(accepted.queries[0].params, ['a'.repeat(50)]);
  });

  const rejected = fakePool();
  await withServer(rejected, async (base) => {
    await assertNameTooLong(await postItem(base, '  ' + 'a'.repeat(51) + ' '), rejected);
  });
});

test('POST /api/items counts name length in characters, not UTF-16 code units', async () => {
  const rejected = fakePool();
  await withServer(rejected, async (base) => {
    await assertNameTooLong(await postItem(base, '\u{1F600}'.repeat(51)), rejected);
  });

  await assertCreated('é'.repeat(50));
  await assertCreated('\u{1F600}'.repeat(26));
  await assertCreated('\u{1F600}'.repeat(50));
});

test('GET /api/me without a session returns 401', async () => {
  await withServer(fakePool(), async (base) => {
    const res = await fetch(`${base}/api/me`);
    assert.equal(res.status, 401);
  });
});
