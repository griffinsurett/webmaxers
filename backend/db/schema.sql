-- Blueprint Agent knowledge base schema (Postgres + pgvector).
-- Idempotent: safe to re-run (also applied by `npm run db:migrate`).

create extension if not exists vector;

-- Structured price rows. The ONLY source of dollar amounts; the LLM never prices.
create table if not exists pricing_catalog (
  sku            text primary key,
  kind           text not null check (kind in ('website_type', 'page', 'content', 'addon')),
  name           text not null,
  description    text not null default '',
  price          numeric(10, 2) not null default 0,  -- one-time price (base price for website types)
  setup          numeric(10, 2) not null default 0,  -- add-on one-time setup
  monthly        numeric(10, 2) not null default 0,  -- add-on recurring
  included_pages integer,                            -- website types: pages covered by base price
  unit           text not null default 'each',
  active         boolean not null default true,
  version        text not null,
  metadata       jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now()
);

-- Embedded knowledge (brand, page guidance, pricing explanations) for RAG.
create table if not exists kb_chunks (
  id         bigserial primary key,
  source     text not null,          -- seed file the chunk came from
  heading    text not null default '',
  content    text not null,
  metadata   jsonb not null default '{}'::jsonb,
  embedding  vector(1536),           -- text-embedding-3-small; null until embedded
  created_at timestamptz not null default now()
);

create index if not exists kb_chunks_source_idx on kb_chunks (source);
create index if not exists kb_chunks_embedding_idx
  on kb_chunks using hnsw (embedding vector_cosine_ops);

-- Cosine-similarity retrieval.
create or replace function match_kb_chunks(query_embedding vector(1536), match_count int default 5)
returns table (id bigint, source text, heading text, content text, metadata jsonb, similarity float)
language sql stable as $$
  select c.id, c.source, c.heading, c.content, c.metadata,
         1 - (c.embedding <=> query_embedding) as similarity
  from kb_chunks c
  where c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Conversation sessions (replaces the in-memory map; used from step 3 onward).
create table if not exists sessions (
  id            text primary key,
  ip            text not null,
  stage         text not null default 'greet',
  slots         jsonb not null default '{}'::jsonb,
  messages      jsonb not null default '[]'::jsonb,
  findings      jsonb,
  blueprint     jsonb,
  message_count integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table sessions add column if not exists strikes integer not null default 0;
alter table sessions add column if not exists stage_turns integer not null default 0;
alter table sessions add column if not exists research_started_at timestamptz;
alter table sessions add column if not exists blueprint_started_at timestamptz;

create index if not exists sessions_ip_idx on sessions (ip);
create index if not exists sessions_ip_created_idx on sessions (ip, created_at);

-- Burst throttling counters (fixed windows, shared by every backend instance and kept across
-- restarts). One row per (bucket, client, window); rows are deleted shortly after the window ends.
create table if not exists rate_limits (
  bucket       text        not null,   -- policy and window, e.g. "chat:10s"
  key          text        not null,   -- normalised client network address
  window_start timestamptz not null,
  window_end   timestamptz not null,
  count        integer     not null default 0,
  primary key (bucket, key, window_start)
);

create index if not exists rate_limits_window_end_idx on rate_limits (window_end);

-- Knowledge uploads. The admin works entirely inside the Supabase dashboard: drop a pricing or guidance file
-- into the "knowledge" storage bucket, review what the agent read in the kb_price_review view, then set the
-- status of the matching kb_uploads row to "approved" (or "rejected"). The backend does the rest.
do $$ begin
  if not exists (select 1 from pg_type where typname = 'kb_upload_status') then
    -- An enum, so the Supabase Table Editor offers these values as a dropdown instead of free text.
    create type kb_upload_status as enum (
      'processing',  -- the backend is reading the file
      'draft',       -- read and checked: waiting for you to approve or reject
      'approved',    -- you approved it: the backend will publish it on its next pass
      'published',   -- in use by the agent
      'rejected',    -- you rejected it: nothing changed
      'reverted',    -- published, then undone
      'failed',      -- could not be read or published: see the error column
      'undo'         -- set this on a published upload to take it back
    );
  end if;
end $$;

create table if not exists kb_uploads (
  id             uuid        primary key default gen_random_uuid(),
  kind           text        not null check (kind in ('pricing', 'guidance')),
  filename       text        not null,
  mime           text        not null,
  bytes          integer     not null,
  status         kb_upload_status not null default 'draft',
  extracted_text text,                       -- what was read from the file (bounded)
  proposal       jsonb,                      -- pricing: per-item before/after + evidence; guidance: chunk preview
  applied        jsonb,                      -- what publishing changed (kept so it can be undone)
  version        text,                       -- catalog version label created by publishing
  error          text,
  storage_path   text,                       -- where the file lives in the storage bucket
  storage_etag   text,                       -- identifies that exact version of the file
  created_at     timestamptz not null default now(),
  published_at   timestamptz,
  reverted_at    timestamptz
);

-- Databases created before the enum (text column + check): convert in place.
do $$ begin
  if (select data_type from information_schema.columns where table_name = 'kb_uploads' and column_name = 'status') = 'text' then
    alter table kb_uploads drop constraint if exists kb_uploads_status_check;
    alter table kb_uploads alter column status drop default;
    alter table kb_uploads alter column status type kb_upload_status using status::kb_upload_status;
    alter table kb_uploads alter column status set default 'draft';
  end if;
end $$;
alter table kb_uploads add column if not exists storage_path text;
alter table kb_uploads add column if not exists storage_etag text;

create index if not exists kb_uploads_created_idx on kb_uploads (created_at desc);
-- A given version of a given file is read once.
create unique index if not exists kb_uploads_storage_uidx on kb_uploads (storage_path, storage_etag) where storage_path is not null;

-- Row-level security with no policies: Supabase's public REST API (which exposes the public schema)
-- can read nothing from these tables. The backend connects as the table owner, which is exempt, so
-- it is unaffected. Idempotent.
alter table pricing_catalog enable row level security;
alter table kb_chunks       enable row level security;
alter table sessions        enable row level security;
alter table rate_limits     enable row level security;
alter table kb_uploads      enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Read-only views for the Supabase Table Editor. "security_invoker" makes them obey the row-level
-- security above, so Supabase's public REST API cannot read anything through them either.
-- ---------------------------------------------------------------------------------------------

-- What the agent read from each uploaded pricing file: old and new figures next to the exact words it used.
drop view if exists kb_price_review;
create view kb_price_review with (security_invoker = true) as
select
  u.id                                              as upload_id,
  u.filename,
  u.created_at                                      as uploaded_at,
  u.status                                          as upload_status,
  u.error,
  i->>'status'                                      as change,
  i->>'sku'                                         as item_code,
  coalesce(i->'after'->>'name', i->'before'->>'name') as item,
  (i->'before'->>'price')::numeric                  as old_price,
  (i->'after'->>'price')::numeric                   as new_price,
  (i->'before'->>'setup')::numeric                  as old_setup,
  (i->'after'->>'setup')::numeric                   as new_setup,
  (i->'before'->>'monthly')::numeric                as old_monthly,
  (i->'after'->>'monthly')::numeric                 as new_monthly,
  (i->'before'->>'includedPages')::int              as old_pages,
  (i->'after'->>'includedPages')::int               as new_pages,
  i->>'quote'                                       as from_the_document,
  array_to_string(array(select jsonb_array_elements_text(i->'warnings')), ' | ') as check_these,
  array_to_string(array(select jsonb_array_elements_text(i->'reasons')),  ' | ') as rejected_because
from kb_uploads u
cross join lateral jsonb_array_elements(u.proposal->'items') i
where u.kind = 'pricing' and u.proposal is not null and jsonb_typeof(u.proposal->'items') = 'array'
order by u.created_at desc, case i->>'status' when 'changed' then 0 when 'new' then 1 when 'rejected' then 2 else 3 end, i->>'sku';

-- Everything visitors have generated: one row per conversation. Open the matching row in the sessions
-- table for the full chat, research and blueprint.
drop view if exists generations;
create view generations with (security_invoker = true) as
select
  s.id                                               as session_id,
  s.created_at,
  s.updated_at,
  s.stage,
  s.slots->>'businessName'                           as business,
  s.slots->>'industry'                               as industry,
  s.slots->>'serviceArea'                            as area,
  s.slots->>'primaryGoal'                            as goal,
  s.slots->>'ownUrl'                                 as own_website,
  s.message_count                                    as messages,
  s.blueprint is not null                            as has_blueprint,
  s.blueprint->>'status'                             as blueprint_status,
  jsonb_array_length(coalesce(s.blueprint->'pages', '[]'::jsonb)) as pages,
  (s.blueprint->'pricing'->'totals'->>'initialInvestment')::numeric as initial_investment,
  (s.blueprint->'pricing'->'totals'->>'monthly')::numeric           as monthly
from sessions s
order by s.created_at desc;

-- Supabase also grants its public roles access to new tables and views by default. Take it away, if those
-- roles exist (they do not on a plain Postgres). The backend connects as the owner and is unaffected.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on pricing_catalog, kb_chunks, sessions, rate_limits, kb_uploads, kb_price_review, generations from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on pricing_catalog, kb_chunks, sessions, rate_limits, kb_uploads, kb_price_review, generations from authenticated;
  end if;
end $$;

-- On Supabase, create the private storage bucket the admin drops files into. A no-op everywhere else.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('knowledge', 'knowledge', false) on conflict (id) do nothing;
  end if;
end $$;
