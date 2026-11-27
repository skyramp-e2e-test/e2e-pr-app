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

// Posts the given name as JSON to POST /api/items on a fresh fake pool.
async function postItemName(name, rows = []) {
  const pool = fakePool(rows);
  let status;
  let body;
  await withServer(pool, async (base) => {
    const res = await fetch(`${base}/api/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(name === undefined ? {} : { name }),
    });
    status = res.status;
    body = await res.json();
  });
  return { status, body, pool };
}

function assertTooLong({ status, body, pool }) {
  assert.equal(status, 400);
  assert.equal(typeof body.error, 'string');
  assert.match(body.error, /too long/i);
  assert.notEqual(body.error, 'name is required');
  assert.equal(pool.queries.length, 0);
}

test('POST /api/items accepts a name of exactly 50 characters', async () => {
  const name = 'a'.repeat(50);
  const { status, body, pool } = await postItemName(name, [
    { id: 1, name, created_at: '2026-01-01T00:00:00Z' },
  ]);
  assert.equal(status, 201);
  assert.equal(body.name, name);
  assert.equal(pool.queries.length, 1);
  assert.deepEqual(pool.queries[0].params, [name]);
});

test('POST /api/items rejects a name over 50 characters and writes nothing', async () => {
  assertTooLong(await postItemName('a'.repeat(51)));
  assertTooLong(await postItemName('a'.repeat(1000)));
});

test('POST /api/items rejects a 51-character form-encoded name and writes nothing', async () => {
  const pool = fakePool();
  await withServer(pool, async (base) => {
    const res = await fetch(`${base}/api/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `name=${'a'.repeat(51)}`,
    });
    assertTooLong({ status: res.status, body: await res.json(), pool });
  });
});

test('POST /api/items measures the name length after trimming', async () => {
  const name = 'a'.repeat(50);
  const accepted = await postItemName(`  ${name}   `, [
    { id: 1, name, created_at: '2026-01-01T00:00:00Z' },
  ]);
  assert.equal(accepted.status, 201);
  assert.equal(accepted.pool.queries.length, 1);
  assert.deepEqual(accepted.pool.queries[0].params, [name]);

  assertTooLong(await postItemName(` ${'a'.repeat(51)} `));
});

test('POST /api/items counts accented characters one each at the 50-character limit', async () => {
  const name = 'é'.repeat(50);
  const accepted = await postItemName(name, [
    { id: 1, name, created_at: '2026-01-01T00:00:00Z' },
  ]);
  assert.equal(accepted.status, 201);
  assert.equal(accepted.pool.queries.length, 1);
  assert.deepEqual(accepted.pool.queries[0].params, [name]);

  assertTooLong(await postItemName('é'.repeat(51)));
});

test('POST /api/items still answers name is required for a missing or non-string name', async () => {
  for (const name of [undefined, ['a'.repeat(60)]]) {
    const { status, body, pool } = await postItemName(name);
    assert.equal(status, 400);
    assert.deepEqual(body, { error: 'name is required' });
    assert.equal(pool.queries.length, 0);
  }
});

test('GET /api/me without a session returns 401', async () => {
  await withServer(fakePool(), async (base) => {
    const res = await fetch(`${base}/api/me`);
    assert.equal(res.status, 401);
  });
});
