# Webmaxxers

One repository, two separate deployments.

```text
webmaxxers/
├── frontend/        the website (Astro + React)           → Vercel,   Root Directory: frontend
├── backend/         the Blueprint Agent API               → Railway,  Root Directory: backend
├── AGENTS.md        instructions for coding agents (kept at the root)
└── CLAUDE.md
```

The two parts share no code. The website talks to the backend over HTTPS, using one setting:
`PUBLIC_AGENT_API_URL` (set on Vercel). Each folder has its own `package.json`, dependencies,
tests and README, and either can be developed, tested and deployed without the other.

## Work on the website

```bash
cd frontend
npm install
npm run build              # production build (static output + Vercel functions)
npm run serve              # serve the built site locally (dist/client)
npm run test:blueprint-client
npm run check:agent-wiring # is the site pointed at a backend its security headers allow?
```

Details: [frontend/README.md](frontend/README.md).

## Work on the backend

```bash
cd backend
npm install
npm run db:up              # local Postgres + pgvector in Docker
npm run dev                # http://localhost:8000
npm test
```

Details: [backend/README.md](backend/README.md). Deploying it: [backend/DEPLOY.md](backend/DEPLOY.md).

## Deploying

| | Website | Backend |
|---|---|---|
| Host | Vercel | Railway |
| Root Directory | `frontend` | `backend` |
| Build | `npm run build` (Vercel runs it) | the `backend/Dockerfile` |
| Needs | `PUBLIC_AGENT_API_URL` | `DATABASE_URL`, `CORS_ORIGINS`, `OPENAI_API_KEY`, `TRUST_PROXY`, `ADMIN_TOKEN` |

Deploy the backend first (it gives you its address), then point the website at it.
The full checklist, including keeping the two deployments from triggering each other, is in
[backend/DEPLOY.md](backend/DEPLOY.md).
