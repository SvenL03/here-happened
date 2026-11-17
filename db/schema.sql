-- Here Happened store schema (Neon Postgres). Idempotent: safe to run again.
-- Applied by scripts/migrate.ts. Keep statements simple (no $$ function bodies):
-- the migration splits this file on semicolons.

-- Finished place stories, keyed by placeKey(lat, lng). Fresh for 30 days.
create table if not exists place_cache (
  key text primary key,
  engine text not null,
  story jsonb not null,
  created_at timestamptz not null default now(),
  hits int not null default 0
);
create index if not exists place_cache_created_at_idx on place_cache (created_at);

-- Uncached lookups per visitor (salted IP hash), in 10-minute buckets.
create table if not exists rate_hits (
  visitor text not null,
  bucket timestamptz not null,
  count int not null default 0,
  primary key (visitor, bucket)
);
create index if not exists rate_hits_bucket_idx on rate_hits (bucket);

-- Paid API calls per UTC day (today only kind = 'geocode').
create table if not exists spend_daily (
  day date not null,
  kind text not null,
  units int not null default 0,
  primary key (day, kind)
);
