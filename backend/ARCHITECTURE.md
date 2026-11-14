# Blueprint Agent Backend — Architecture

Goal: turn a short, focused chat into a **website blueprint** (sitemap, page
content, add-ons) with a **transparent, deterministic price breakdown**.

Decisions:

- **LLM provider: OpenAI only** (chat, analysis, embeddings, web search).
- **Database (demo): local Docker Postgres + pgvector.** This is separate from the site
  chatbot's Supabase project. The same SQL moves to a dedicated Supabase project later.
- **No competitor URL given:** the agent finds 2–3 local competitors via OpenAI web
  search, shows them to the visitor, and analyzes them.

---

## 1. Components

```
Frontend (BlueprintAgent.tsx)
   │  POST /api/chat (streamed)      POST /api/price
   ▼
Express backend
   ├── Conversation engine   stage machine + slot filling + guardrails
   ├── Research engine       crawl own site + competitor sites → findings
   ├── Blueprint generator   LLM picks pages/sections/add-ons (structured JSON)
   ├── Pricing engine        deterministic totals from the catalog (never the LLM)
   └── Knowledge base        Postgres + pgvector
          ├── pricing_catalog   structured price rows (source of truth for $)
          ├── kb_chunks         embedded brand/pricing/guidance text (RAG)
          └── sessions          conversation state, findings, blueprint
```

---

## 2. Knowledge base (pgvector)

One seed file (`backend/kb/demo-pricing.json` + `backend/kb/*.md`) is loaded by
`npm run kb:seed`, which:

1. Upserts **structured rows** into `pricing_catalog` (deterministic pricing).
2. Chunks and embeds the same knowledge into `kb_chunks` (RAG context for the LLM:
   what each page type includes, when to recommend it, brand positioning).

When pricing changes, the seed document is edited and re-synced; nothing is hard-coded.

**Demo catalog (placeholder numbers):**

| Kind | Item | Price |
|---|---|---|
| Website type | Starter site (up to 5 pages) | $1,250 |
| Website type | Lead-gen business site (up to 10 pages) | $2,250 |
| Website type | E-commerce starter (up to 10 pages + store) | $3,500 |
| Page | Standard page | +$250 |
| Page | Service page | +$250 |
| Page | Location / service-area page | +$200 |
| Page | Advanced page (calculator, gallery, portal) | +$450 |
| Content | Blog / resource article | +$150 |
| Add-on | Managed forms | $150 setup + $25/mo |
| Add-on | AI customer service chat | $500 setup + $79/mo |
| Add-on | Appointment booking | $250 setup |
| Add-on | Quote / estimate system | $400 setup |
| Add-on | CRM integration | $300 setup |
| Add-on | Review integration | $150 setup + $15/mo |
| Add-on | Payments | $300 setup |
| Add-on | Newsletter signup | $100 setup |

Tables:

- `pricing_catalog(sku pk, kind, name, description, price, setup, monthly, unit, active, version)`
- `kb_chunks(id, source, content, metadata jsonb, embedding vector(1536))` with an HNSW cosine index
- `match_kb_chunks(query_embedding, match_count)`: SQL function for retrieval
- `sessions(id, ip, stage, slots jsonb, messages jsonb, findings jsonb, blueprint jsonb, message_count, created_at)`

---

## 3. Conversation flow

The chat stays short. Each user turn runs one LLM call that returns structured output:
`{ reply, extractedSlots, nextStage, quickReplies, offTopic }`.

| Stage | What the agent does | Exit when |
|---|---|---|
| 1. Greet | Welcomes the visitor and asks what business they own | Business name and type are known |
| 2. Intake | Asks a few quick questions as one story: services, location/service area, main goal (calls, quotes, bookings, sales), own website (optional) | Required slots are filled (max ~4 turns) |
| 3. Competitors | Asks for 1–3 competitor URLs | URLs given, or skipped |
| 4. Research | Crawls the sites and streams progress ("Analyzing competitor nav…") | Findings saved |
| 5. Blueprint | Generates sitemap, page content, add-ons; pricing engine prices it | Blueprint returned |
| 6. Refine | Answers questions, adds or removes pages and add-ons on request | Visitor is happy |
| 7. Close | Shows the final estimate and the strategy-call CTA | — |

**Required slots:** business name, industry, services, service area, primary goal.
**Optional slots:** own URL, competitor URLs, existing tools (CRM, booking), must-have features.

**Guardrails (phase 3, implemented):**

- **Server owns the state.** The client sends only `{ sessionId, message }` (extra fields are rejected). Stage, slots and history live in Postgres. Session ids are server-minted UUIDs.
- **Code decides, the model phrases.** The model extracts slots and writes one sentence plus one question. Stage changes, quick replies, URL acceptance, the competitor question and all fallbacks come from code. Model output is re-validated (zod), length-capped, and discarded if it contains markup, links, injection phrasing or encoded blobs.
- **Message screening** (before the model or storage): strips invisible/bidi characters, caps length at 1,000 characters, and rejects HTML/script tags, code fences, shell and SQL fragments, template syntax, non-web URL schemes (`javascript:`, `data:`, `file:`...), big encoded blobs and prompt-injection phrasing. A rejected message never reaches the model. 3 strikes close the session.
- **Website address verification.** Addresses are extracted by code and the model only sees placeholders (`[URL1]`). Each address must pass:
  - http/https only, no credentials, ports 80/443 only, a real DNS name (no IPs in any encoding, no `localhost` or `.local`/`.internal`), no `xn--` look-alikes, no URL shorteners or file-sharing hosts, no download extensions
  - a DNS lookup where every resolved address is public (blocks private, loopback, link-local and cloud-metadata ranges)
  - at most 1 own site and 3 competitors, no duplicates
  Probing internal addresses counts as a strike; a typo does not.
- **Hostile-input limits (phase 4 review):** robots.txt patterns use a linear glob matcher (no regex); every request has an absolute time cap on top of the idle timeout; HTML is pre-scanned and refused if nested deeper than 256 levels or over 150k tags (parsers are quadratic on deep nesting); text extraction is a single iterative pass with node and character caps; regexes over page text are bounded and the text is length-capped; robots.txt is re-checked on every redirect hop and each hop and robots file counts against the fetch budget; model-written findings may not contain web addresses except the analyzed sites'; invisible and format characters (including Unicode tag characters) are stripped before screening; a whole research job has a 4-minute ceiling.
- **Never executed.** Phase 4 must re-run the DNS check right before every fetch and on every redirect, cap response size and time, and parse HTML as text only. Nothing fetched is ever executed or rendered, and research runs only on URLs stored in the session, never on an address sent with a request. The old public `/api/audit` and `/api/blueprint` stubs are disabled (501).
- **Off-topic** gets a fixed redirect line, never an answer. The agent never asks for a slot it already has, and stays on one question at a time.
- **Short by design:** intake moves on after 6 turns even with gaps; the competitor question after 3.
- **Limits** in Postgres: 40 messages per session, 5 new sessions per IP per 24 hours, sessions expire after 24 hours. Set `TRUST_PROXY` when deployed behind a proxy so the IP is the visitor's.

Not covered: a site can still be malicious. A reputation lookup (e.g. Google Safe Browsing) could be added later as an extra check, but it sends visitor URLs to a third party, so it needs your approval first.

---

## 4. Competitor and own-site research

For each URL (own site optional, competitors 1–3):

1. **Crawl.** Fetch the homepage and discover nav links. Crawl up to ~8 key pages per site
   (services, about, pricing, contact, locations). Fall back to a headless browser when
   the HTML is empty (JS-rendered sites).
2. **Extract** (deterministic): page list and nav tree, H1/H2/H3, CTAs and forms, phone/booking
   links, trust signals (reviews, certifications, warranties, financing), service and
   location pages, blog presence, schema types, word count per page.
3. **Analyze** (LLM over extracted data only): what works for each competitor, and why;
   what they are missing; gaps in the client's own site (Keep / Improve / Consolidate / Add);
   opportunities the new site should claim.
4. Every blueprint recommendation cites a finding (`evidence` field), or is marked
   "reasonable recommendation" or "insufficient information".

Without an own site, step 3 skips the teardown and uses competitor findings plus intake.

---

## 5. Blueprint generation

Input: slots, research findings, and the top-k KB chunks (page and add-on guidance).
Output (strict JSON schema): the existing frontend `BlueprintState` plus `evidence`
on each page and add-on.

- Hierarchical sitemap: Home → About / Services → each service / Locations / Resources → articles / Contact.
- Per page: title, slug, purpose, why, **content sections with subsections**, primary CTA,
  classification (core / recommended / future) and **catalog SKU**.
- Article ideas: title, customer question, related service, conversion path, priority.
- Add-ons: recommended vs. other, each with a reason, or "not recommended" with a reason.

The LLM outputs **SKUs only, never prices**. The pricing engine attaches prices.

**Rule-driven planning (`kb/blueprint-rules.json`, demo data like the prices):** what can be decided by rules is, so the same business gets the same plan every time. Core pages come from an industry template (home services, restaurant, clinic, professional services, retail, B2B tech, generic). Every service and every service area the visitor named gets its own page. The website type starts as Starter (e-commerce for online sales) and the pricing engine adopts a cheaper type of the same family. Add-ons are chosen by conditions on the goal, industry, competitor evidence (competitors offering or lacking booking, chat, reviews) and the visitor's existing tools, with dependencies (notifications need a form, quote or booking tool), one chat tool at most, and a cap of 6. Default selection is also fixed: 3 articles, and any extra pages the model suggests arrive as optional "future" ideas with their evidence. The model writes all wording and reasons, and may add one evidence-backed add-on exception. Measured with identical input: 5 stability runs and 3 full live runs gave the identical page set, add-ons and total.

**Guarantees enforced in code (phase 5, reviewed):** exactly one Home and one Contact page (Contact always has the id `contact` and sits directly under Home, so removing any other page can't remove it); at most 5 core pages; unique ids, slugs and paths; depth ≤ 3; page, article and location caps; article ids never collide with page ids; model ids are remapped consistently so parents and article links survive renames; evidence may cite only facts the model was shown; model text may not contain prices, rates, number-word amounts, invented years/percentages/licence numbers, links or unknown domains; free-text answers with figures are withheld and replaced by the engine's own estimate; generation, refinement and manual toggles all use one pricing routine; a cancelled run is aborted (not left spending tokens) and keeps its concurrency slot until it really stops; one chat message per session at a time (advisory lock) and stale writes cannot move a session's stage backwards.

---

## 6. Pricing engine

`price(blueprint, catalog)` returns:

```
Website base (type SKU)            $1,250   (includes up to 5 pages)
+ Extra pages        n × SKU price
+ Articles           n × SKU price
+ Add-on setup       Σ setup
= Total initial investment
Ongoing              Σ monthly / mo
```

The same function runs on the client for instant toggling, and on `POST /api/price`
for the authoritative number.

---

## 7. API

| Route | Purpose |
|---|---|
| `GET /health` | Liveness |
| `POST /api/chat/start` | Creates a session, returns the greeting |
| `POST /api/research` | `{ sessionId }` → SSE stream: `step`, `competitors`, `site` events, then `done` (findings) or `error`. Runs only on URLs stored in the session, once the stage is `research`; one run per session; at most 3 jobs at once; a finished run is replayed from storage |
| `POST /api/blueprint` | `{ sessionId }` → SSE: `step` (retrieving, structuring, writing, pricing), `page` progress, then `done` (the Blueprint). Needs stage `blueprint`; one build per session; replay from storage; 3 at once; 3-minute ceiling |
| `POST /api/blueprint/edit` | `{ sessionId, ops }` → UI toggles (remove/restore page, toggle add-on or article), applied under a row lock and re-priced by the engine; returns the updated blueprint, changes, refusals |
| `GET /api/session/:id` | Read-only restore after a page refresh: stage, visible conversation, research results, blueprint. The unguessable session id is the only credential (no login). Errors across the API carry a stable `code` (`not_found`, `in_progress`, `busy`, ...) |
| `POST /api/chat` | One turn: `{ sessionId, message }` → reply, quick replies, notices, stage, progress, slots. JSON for now; streaming (SSE) arrives with research progress in phase 4 |
| `POST /api/price` | Recompute totals for the selected pages and add-ons |
| `GET /api/catalog` | Active catalog (lets the frontend price toggles offline) |
| `POST /api/kb/sync` | Admin-only re-seed and re-embed (protected by an admin token) |

---

## 8. Build phases

Each phase ends with something runnable and testable. Do not start the next phase until the current one passes its exit check.

| Phase | Scope | Exit check |
|---|---|---|
| 1 ✅ | **Knowledge base.** Postgres + pgvector schema, demo KB seed, retrieval | `npm run kb:search` returns relevant chunks |
| 2 ✅ | **Pricing engine.** `/api/price`, `/api/catalog`, unit tests | 9 tests pass; worked example matches by hand |
| 3 ✅ | **Conversation engine.** Sessions in Postgres, stage machine, slot filling, guardrails, `/api/chat` (SSE). No research yet. | A scripted chat reaches the "competitors" stage with all required slots filled; off-topic is redirected |
| 4 ✅ | **Research engine** (4a safe fetcher + robots ✅; 4b crawler ✅; 4c extractor ✅; 4d competitor discovery ✅ (OpenAI call untested until key is set); 4e analysis ✅ (OpenAI call untested); 4f job + SSE ✅; JS-heavy sites are flagged "limited visibility", no headless browser; discovered competitors are shown and used automatically). Competitor discovery (OpenAI web search), crawl, deterministic extraction, LLM analysis with `evidence` | Given 1 real competitor URL, returns structured findings; with none, finds 2–3 and returns findings |
| 5 ✅ | **Blueprint generator** (5a model, 5b retrieval, 5c/5d two model passes, 5e verifier, 5f pricing, 5g endpoint, 5h refine chat; OpenAI calls untested until the key is set). Strict-JSON sitemap, page sections, add-ons (SKUs only), priced by phase 2 | A full chat produces a blueprint whose total equals `/api/price` for the same selection |
| 6 ✅ | **Frontend wiring** (6A client, 6B adapter, 6C live UI, 6D offline demo done and reviewed; 6E mobile layout and contrast done (audited at 360, 390, 768 and desktop widths)). Replace mockData with the API, live add-on toggling and price breakdown, mocks kept as offline fallback | End-to-end in the browser: chat → research progress → blueprint → toggle add-on → price updates |
| 7 | **Hardening.** Burst throttling, error and timeout handling, logging, README refresh, Docker/deploy config | Limits enforced across restarts; failed research degrades gracefully |

Phase 3's model call is untested against OpenAI until `OPENAI_API_KEY` is set in `backend/.env`. Its logic is covered by tests with a fake model.
