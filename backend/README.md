# Webmaxxers Blueprint Agent: backend

The API behind the website's **AI Website Blueprint Builder** (`/blueprint`). A visitor chats about
their business; the service researches their site and local competitors, then produces a sitemap,
page outlines, add-ons and a **price computed by code from the catalog, never by the model**.

- Node 22, Express 5, TypeScript, Postgres 17 + pgvector, OpenAI (the only model provider).
- Deploying it: see [DEPLOY.md](DEPLOY.md). How it works inside: see [ARCHITECTURE.md](ARCHITECTURE.md).

## Run it locally

```bash
cd backend
cp .env.example .env          # add OPENAI_API_KEY (optional: without it the assistant is "unavailable")
npm install
npm run db:up                 # Postgres + pgvector in Docker (port 54329)
npm run dev                   # http://localhost:8000
```

On start the server applies the schema and, on an empty database, loads the price catalog and
knowledge base from `kb/`. Then point the site at it: `PUBLIC_AGENT_API_URL=http://localhost:8000`.

| Command | What it does |
|---|---|
| `npm run dev` | Server with reload |
| `npm test` | Unit and route tests (database tests skip themselves if Postgres is not running) |
| `npm run typecheck` | TypeScript check |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm run db:up` / `db:down` / `db:reset` | Local Postgres (`db:reset` wipes its data) |
| `npm run kb:seed` | Re-load `kb/` into the database by hand |
| `npm run smoke -- <url> [site-origin]` | Read-only post-deploy checks against a running backend |

## API

| Route | Purpose |
|---|---|
| `GET /health` | `200` only when the database answers; `503` when degraded or shutting down |
| `GET /api/catalog`, `POST /api/price` | Price catalog and deterministic pricing |
| `POST /api/chat/start`, `POST /api/chat` | Conversation (server-side sessions; the browser sends only `sessionId` + `message`) |
| `GET /api/session/:id` | Restore a conversation after a page refresh (no login; the random id is the credential) |
| `POST /api/research` | Server-sent events: competitor discovery, crawling, analysis |
| `POST /api/blueprint`, `POST /api/blueprint/edit` | Server-sent events: blueprint generation; deterministic manual edits |
| `POST /api/kb/sync`, `POST /api/kb/search` | Admin: re-import the seed files (refused once prices were published from an upload, unless forced) / inspect search |
| `GET /api/admin/metrics` | Admin: counters and timings for this instance |

## Where prices come from

Every dollar amount comes from the price catalog (`pricing_catalog`), and code, not the model, adds them up. The first time
a database is empty, the catalog and knowledge base load from `kb/` (demo data). After that **the Supabase dashboard is the
admin tool**: drop a pricing PDF or text file into the `knowledge/pricing` storage folder, review what the agent read in the
`kb_price_review` view (every number is checked by code against the file's own words), set the row's status to `approved`
in `kb_uploads`, and the new prices are live. Everything visitors generate is browsable in the `generations` view. Steps:
[DEPLOY.md](DEPLOY.md) section 3b. Running the database on Supabase: section 3c.

## What protects it

- **Daily caps** (Postgres): 5 conversations per network per 24h, 40 messages per conversation.
- **Burst throttling** (Postgres, survives restarts): every `/api` request is limited per 10 seconds
  and per minute, with tighter limits on chat, research, blueprint and admin routes. A throttled
  request gets `429` with `Retry-After` and `code: "rate_limited"`, which the site treats as "try again".
- **Concurrency caps:** 3 research runs and 3 blueprint runs at a time.
- **Input guard:** message screening, URL safety checks (DNS + private-address blocking), a 3-strike lockout.
- **Crawler safety:** robots.txt, SSRF protection, size and time caps.

## When things fail

- Every model call has a total deadline, retries with backoff, and a circuit breaker that fails fast
  while the provider is down. Visitors see "busy" or "unavailable", never provider text.
- A failed research run is recorded as "could not read", and the blueprint is built from the
  visitor's own answers. A failed blueprint run falls back to a deterministic blueprint.
- A chat turn that fails on our side gives the message back.
- Knowledge search falls back to keywords if embeddings fail.

## Logs and metrics

One JSON object per line on stdout/stderr, each with a `requestId` (also returned as `X-Request-Id`
and carried into background jobs). Visitor message text, prompts, session ids, keys and emails are
never written. Set `LOG_LEVEL` (`debug`, `info`, `warn`, `error`, `silent`). Counters and timings
for requests, jobs, model calls and throttling are at `GET /api/admin/metrics`.

## Layout

```text
backend/
├── Dockerfile · docker-compose.yml (dev DB) · docker-compose.prod.yml (API + DB) · railway.json
├── db/schema.sql            idempotent schema, applied on every start (under a database lock)
├── kb/                      price catalog, blueprint rules, brand and page-guidance text (demo data)
├── scripts/smoke.mjs        post-deploy checks
└── src/
    ├── index.ts · app.ts    start-up (config check, migrate, seed, shutdown) · the Express app
    ├── config/              environment loading and start-up validation
    ├── middleware/          CORS, request id + access log, admin auth
    ├── routes/              one file per endpoint group
    └── services/
        ├── conversation/    stage machine, slot filling, sessions
        ├── research/        discovery, polite crawler, fact extraction, analysis
        ├── blueprint/       planning rules, generation, verification, refinement
        ├── pricing/         deterministic pricing engine
        ├── llm/             the only place model calls are made (deadlines, breaker, errors)
        ├── ratelimit/       burst throttling
        ├── log/             structured logger and metrics
        ├── rag/             knowledge base: sync and search
        ├── kbadmin/         admin uploads: read files, propose and verify price changes, publish and undo
        └── security/        input and URL guards
```
