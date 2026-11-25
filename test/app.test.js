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

// Stand-in for the pg pool that keeps inserted items, so GET /api/items reads back what POST stored.
function memoryPool() {
  const items = [];
  return {
    items,
    query: async (sql, params) => {
      if (sql.startsWith('INSERT INTO items')) {
        const row = { id: items.length + 1, name: params[0], created_at: '2026-01-01T00:00:00Z' };
        items.push(row);
        return { rows: [row] };
      }
      if (sql.startsWith('SELECT id, name, created_at FROM items')) return { rows: [...items] };
      throw new Error(`unexpected query: ${sql}`);
    },
  };
}

function postItem(base, name) {
  return fetch(`${base}/api/items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

async function itemNames(base) {
  const res = await fetch(`${base}/api/items`);
  assert.equal(res.status, 200);
  return (await res.json()).map((item) => item.name);
}

test('POST /api/items accepts a name of exactly 50 characters', async () => {
  await withServer(memoryPool(), async (base) => {
    const name = 'n50'.padEnd(50, 'x');
    assert.equal(name.length, 50);
    const res = await postItem(base, name);
    assert.equal(res.status, 201);
    assert.equal((await res.json()).name, name);
    assert.deepEqual((await itemNames(base)).filter((n) => n === name), [name]);
  });
});

test('POST /api/items rejects 51- and 500-character names with the same too-long error and stores nothing', async () => {
  await withServer(memoryPool(), async (base) => {
    const before = await itemNames(base);

    const name51 = 'n51'.padEnd(51, 'x');
    const res51 = await postItem(base, name51);
    assert.equal(res51.status, 400);
    const error51 = (await res51.json()).error;
    assert.equal(typeof error51, 'string');
    assert.notEqual(error51, 'name is required');
    assert.match(error51, /too long/i);
    assert.deepEqual(await itemNames(base), before);

    const name500 = 'n500'.padEnd(500, 'x');
    const res500 = await postItem(base, name500);
    assert.equal(res500.status, 400);
    assert.equal((await res500.json()).error, error51);
    assert.deepEqual(await itemNames(base), before);
  });
});

test('POST /api/items applies the 50-character limit to the trimmed name', async () => {
  await withServer(memoryPool(), async (base) => {
    const name50 = 'p50'.padEnd(50, 'x');
    const name51 = 'p51'.padEnd(51, 'x');

    const accepted = await postItem(base, `   ${name50}   `);
    assert.equal(accepted.status, 201);
    assert.equal((await accepted.json()).name, name50);

    const rejected = await postItem(base, `  ${name51}  `);
    assert.equal(rejected.status, 400);
    const error = (await rejected.json()).error;
    assert.notEqual(error, 'name is required');
    assert.match(error, /too long/i);

    const names = await itemNames(base);
    assert.deepEqual(names.filter((n) => n === name50), [name50]);
    assert.equal(names.filter((n) => n.trim() === name51).length, 0);
  });
});
