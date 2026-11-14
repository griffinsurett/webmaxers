# Deploying the Blueprint Agent backend

The backend is one container plus one Postgres database with the pgvector extension. Nothing else
is needed: no queue, no cache, no cron.

## 1. What to set

Set these as environment variables on the host (Railway **Variables**, or `.env.production` for
`docker-compose.prod.yml`). The server checks them on start and **refuses to start** in production
if a required one is wrong. The reason is printed in the logs.

| Variable | Required | Value |
|---|---|---|
| `NODE_ENV` | yes | `production` (the Dockerfile sets it) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | for dashboard updates | The agent's own Supabase project address and its **service role** key (private: server only, never in the website). Both or neither. Section 3b |
| `KB_BUCKET`, `KB_POLL_SECONDS` | no | Storage bucket name (`knowledge`) and how often it is checked (`60`) |
| `DATABASE_SSL` | for hosted databases | `disable` (default), `require`, or `no-verify`. Supabase needs `no-verify` (see section 3c) |
| `DATABASE_URL` | yes | Postgres connection string. The database must allow `create extension vector` (the `pgvector/pgvector` image does; check your host's Postgres offers pgvector). Not the dev credentials |
| `CORS_ORIGINS` | yes | The site origin, comma-separated if several: `https://webmaxxers.com`. Scheme + host only: no path, no trailing slash, no `*` |
| `OPENAI_API_KEY` | yes for a working assistant | Server-side only. Never expose it to the site build. Without it visitors are offered the demo |
| `TRUST_PROXY` | yes behind a platform router | Number of proxies in front of the service (`1` on most hosts). With `0`, every visitor shares one address and one rate limit |
| `ADMIN_TOKEN` | recommended | 24+ random characters. Enables `/api/kb/sync` and `/api/admin/metrics`. Empty disables them |
| `PORT` | no | Hosts like Railway set it. Default `8000` |
| `LOG_LEVEL` | no | `info` by default |
| `RATE_LIMIT_ENABLED` | no | `true` by default. Leave it on |
| `MAX_MESSAGES_PER_SESSION`, `MAX_SESSIONS_PER_IP` | no | `40` and `5` |
| `OPENAI_*_MODEL` | no | Model overrides; see `.env.example` |

## 2. Railway

1. Create a Postgres service **with the pgvector extension available**, and a service from this repo.
2. On the backend service set **Root Directory** to `backend`. The Dockerfile and `railway.json`
   are written for that: the build context is the `backend/` folder.
3. Set the variables above. Use Railway's reference to the database service for `DATABASE_URL`.
4. Deploy. The platform waits for `GET /health` to return `200` (database reachable) before
   switching traffic, and stops sending traffic to an instance that is shutting down.

Any host that runs a Docker image works the same way. To run the whole stack yourself:

```bash
cp .env.production.example .env.production        # fill it in
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## 3. What happens on start

1. Environment is validated (errors stop the start; warnings are logged).
2. The schema is applied, retrying for about 30 seconds if the database is still starting. This is
   safe to run from several instances at once.
3. On an **empty** database the price catalog and knowledge base are loaded from `kb/`. Later
   deploys never overwrite them. If embeddings fail at that moment the catalog still loads and
   search uses keywords until you run `POST /api/kb/sync` with the admin token.
4. The server listens. On `SIGTERM` it reports `503` on `/health`, lets in-flight work finish for
   up to 25 seconds, then exits.

## 3b. Updating prices and guidance: from the Supabase dashboard

There is no separate admin tool. The Supabase dashboard is the admin tool. Everyone who can log in to the agent's Supabase
project can do this, with nothing else to install.

**Once, to switch it on:** set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` on the backend (Project Settings, API). The
database setup creates a private storage bucket called `knowledge` for you. The backend logs
`watching the Supabase storage bucket for knowledge files` when it is on.

**To change prices**
1. Supabase dashboard, **Storage**, bucket `knowledge`, folder **`pricing`**: upload your price list (PDF, `.txt` or `.md`, up to 5 MB).
2. Within about a minute, open **Table Editor**, view **`kb_price_review`**. Each row is one price the agent found: the old
   figure, the new figure and the exact words from your file it relied on. A "check_these" column flags anything unusual, and
   "rejected_because" explains anything it could not back up with your file's own words (those are never used).
3. Table **`kb_uploads`**: find your file's row and change **status** to **`approved`** (or **`rejected`**).
4. Within about a minute the status becomes **`published`**, and new quotes use the new prices. If something is wrong the status
   becomes **`failed`** and the **error** column says why.
5. To take it back, change the status of the most recent published row to **`undo`**.

An upload is a partial update: only the prices it mentions change. Approving applies every verified change in the file. To leave
one out, edit the file and upload it again. The items the agent relies on (`site-starter`, `page-standard`, `content-hub` and
the others named in the blueprint rules) can be changed but never removed, and publishing is refused if it would break them.
Prices are always added up by code from the catalog; the model never states a price to a visitor.

**To add guidance** (how to describe pages, rules of thumb): upload to the **`guidance`** folder, then approve the same way. It
only adds searchable text. Keep dollar amounts out of it (the draft warns you): put them in a pricing file, so every figure
lives in one place.

**To see what visitors generated:** Table Editor, view **`generations`**: one readable row per conversation (business,
area, goal, stage, pages, total price, monthly). Open the same session id in the **`sessions`** table for the whole chat,
research and blueprint.

`kb/demo-pricing.json` and `kb/blueprint-rules.json` are **demo data** that load only the first time the database is empty. Once
prices have been published from an upload, `POST /api/kb/sync` refuses to run (it would put the demo prices back) unless you
send `{"force": true}`.

**First-time check on your real Supabase project** (this path was tested against a faithful fake of Supabase Storage, not a
live project): deploy, then upload a small `.txt` price list to `knowledge/pricing`; a row should appear in `kb_uploads` within
a minute. If nothing appears, check the backend logs for `knowledge sync` lines, and that the bucket is named `knowledge`.

## 3c. Using Supabase as the database

The backend only needs a Postgres with the pgvector extension, which Supabase is. Use a Supabase project **dedicated to
the agent** (not the website chatbot's).

1. Create the project. Under Database, Extensions, make sure `vector` is enabled (the schema also creates it).
2. Set `DATABASE_URL` to the project's **direct connection** string, or the **session pooler** (port 5432). Do **not** use
   the transaction pooler (port 6543): the backend relies on session-level locks, which it does not support.
3. Set `DATABASE_SSL=no-verify` (Supabase requires TLS and signs with its own certificate authority). Use `require` only
   if you have installed that CA.
4. Deploy. On first start the schema is applied (including the `knowledge` bucket) and the catalog is loaded, exactly as with any other Postgres.

The schema turns on row-level security for every table with no policies, so Supabase's public REST API can read nothing
from them; the backend connects as the table owner, which is exempt. Every visitor's chat, research and blueprint is
stored in the `sessions` table of that database.

## 4. After every deploy

```bash
npm run smoke -- https://<backend-url> https://webmaxxers.com
```

Read-only and free (no conversation, no model call). It checks health, that prices are loaded,
that the site origin is allowed by CORS and an unknown one is not, and that admin routes are not
public. All checks must pass.

## 4b. One repository, two deployments

The website (`frontend/`, on Vercel) and this backend (`backend/`, on Railway) live in one Git repo
and deploy separately. They share no code: the only link between them is the backend's web address.

| | Website | Backend |
|---|---|---|
| Folder | `frontend/` | `backend/` |
| Host | Vercel | Railway |
| Root Directory (host setting) | `frontend` | `backend` |
| Redeploy only when | something inside `frontend/` changes | something inside `backend/` changes |

To stop a change to one from redeploying the other (dashboard wording may differ slightly):

- **Railway, service, Settings:** set **Root Directory** to `backend` and **Watch Paths** to `/backend/**`.
- **Vercel, project, Settings, General:** set **Root Directory** to `frontend`.
- **Vercel, project, Settings, Git, Ignored Build Step:** use `git diff --quiet HEAD^ HEAD -- .`
  This runs inside `frontend/`. Exit code 0 skips the build (nothing in `frontend/` changed); any
  other result builds, so a missing history or an error errs on the side of building.

The Ignored Build Step and Watch Paths are optional: without them a push simply redeploys both,
which is harmless. **Root Directory is not optional.** The Vercel project must be set to `frontend`
before this layout is pushed, or its build will not find the site.

If you use the Vercel CLI, link the project from the repository root (not from inside `frontend/`),
because the project's Root Directory setting is applied on top of where you run it.

## 5. Connecting the website

The site and the backend are separate deployments. Three things must agree, and
`npm run check:agent-wiring`, run from `frontend/`, checks them (add `-- --strict` for a release):

1. **Site build variable:** `PUBLIC_AGENT_API_URL=https://<backend-url>` (no trailing slash).
   Without it the production site does not try to reach any backend and offers the demo.
2. **Site security headers:** the page Content-Security-Policy in `frontend/vercel.json` must list the
   backend origin in `connect-src`, or the browser blocks every request. Add `https://<backend-url>`.
3. **Backend CORS:** `CORS_ORIGINS` on the backend must include the site origin.

Vercel preview deployments have different origins and are not allowed by default; add one to
`CORS_ORIGINS` only when testing a preview on purpose.

## 6. Day to day

- **Logs:** JSON lines. Search by `requestId` (the `X-Request-Id` header a visitor can quote).
- **Health:** `GET /health`. **Metrics:** `GET /api/admin/metrics` (bearer token).
- **Roll back:** redeploy the previous image. The schema only ever adds, so older images keep working.
- **Model outage:** nothing to do. Calls fail fast, visitors are told to retry or are offered the
  demo, and research and blueprints fall back to what the visitor told us.
