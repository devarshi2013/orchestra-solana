/**
 * The strategies database: plain SQL, idempotent, no imports (so the
 * `pnpm db:migrate` script can run it with Node's type stripping).
 */

/** The schema the tables live in, so they never collide with anything else in the database. */
export const SCHEMA = "tickertape";

/**
 * DATABASE_URL (the Neon / Vercel Postgres connection string) as the `postgres`
 * driver takes it: always over TLS, with the connection-string options the
 * driver doesn't accept (`sslmode`, `channel_binding`) removed.
 */
export function driverUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  for (const param of ["sslmode", "channel_binding"]) url.searchParams.delete(param);
  return url.toString();
}

/** Every table, schema-qualified: poolers in transaction mode don't keep a search_path. */
export const T = {
  users: `${SCHEMA}.users`,
  strategies: `${SCHEMA}.strategies`,
  notifications: `${SCHEMA}.notifications`,
  fills: `${SCHEMA}.fills`,
  authNonces: `${SCHEMA}.auth_nonces`,
  snapshots: `${SCHEMA}.portfolio_snapshots`,
} as const;

export const migrationSql = `
create schema if not exists ${SCHEMA};

create table if not exists ${T.users} (
  wallet text primary key,
  webhook_url text,
  created_at timestamptz not null default now()
);

create table if not exists ${T.strategies} (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  mint text not null,
  symbol text not null,
  ticker text not null,
  name text not null,
  usdc_amount numeric not null,
  condition jsonb not null,
  repeat boolean not null default false,
  status text not null default 'watching',
  created_at timestamptz not null default now(),
  triggered_at timestamptz,
  trigger_value numeric,
  last_fill_signature text,
  next_run_at timestamptz
);
create index if not exists strategies_wallet_idx on ${T.strategies} (wallet);
create index if not exists strategies_status_idx on ${T.strategies} (status);

create table if not exists ${T.notifications} (
  id uuid primary key default gen_random_uuid(),
  wallet text not null,
  strategy_id uuid,
  kind text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists notifications_wallet_idx on ${T.notifications} (wallet, created_at desc);

create table if not exists ${T.fills} (
  signature text primary key,
  wallet text not null,
  strategy_id uuid,
  mint text not null,
  symbol text not null,
  side text not null,
  usdc_amount numeric not null,
  token_amount numeric not null,
  price numeric not null,
  block_time timestamptz not null
);
create index if not exists fills_wallet_idx on ${T.fills} (wallet, block_time desc);

create table if not exists ${T.authNonces} (
  nonce text primary key,
  wallet text,
  expires_at timestamptz not null
);

-- An earlier, hourly version of the snapshots table (keyed by "at") is set aside, not dropped.
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = '${SCHEMA}' and table_name = 'portfolio_snapshots' and column_name = 'at') then
    alter table ${T.snapshots} rename to portfolio_snapshots_hourly_old;
  end if;
end $$;

-- One row per wallet per UTC day. "snapshot" rows (written by the watcher) value every listed
-- stock token held plus USDC; "backfill" rows are rebuilt from recorded fills × daily closes and
-- value only those holdings (USDC is unknown then). pnl is always the recorded holdings' value
-- minus their cost.
create table if not exists ${T.snapshots} (
  wallet text not null,
  day date not null,
  value numeric not null,
  cost_basis numeric not null,
  pnl numeric not null,
  usdc numeric,
  positions jsonb not null,
  source text not null,
  created_at timestamptz not null default now(),
  primary key (wallet, day)
);
`;
