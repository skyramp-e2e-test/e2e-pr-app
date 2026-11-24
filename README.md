# e2e-pr-app

A small Node.js (Express) + PostgreSQL app used to test Testbot runs on pull requests. Owner: agent d.

## What's inside

| Path | Description |
| --- | --- |
| `GET /` | Home page |
| `GET /login` | Login page (form posts to `POST /login`) |
| `GET /items` | Items page: lists items and lets you add new ones |
| `GET /api/items` | JSON list of items |
| `POST /api/items` | Create an item. Body: `{"name": "..."}`. Returns `201` with the created item; returns `400` if `name` is missing |
| `GET /health`, `GET /healthz` | Health checks. Both return `200` |

`docker-compose.yml` defines two services:

- `db`: PostgreSQL 16
- `app`: this Express server. It waits for `db` to be healthy before starting.

On startup the app creates its tables and seeds the test user `test@example.com` / `password123`.

No credential or other configuration is needed.

## Start the app

Requires Docker with Compose v2.

```bash
docker compose up --build
```

Then open http://localhost:3000. To stop the app and delete the database volume: `docker compose down -v`.

## Lint and tests

Requires Node.js 18 or newer. The unit tests use Node's built-in test runner and need no database.

```bash
npm ci
npm run lint
npm test
```

`.github/workflows/ci.yml` runs both on every pull request.
