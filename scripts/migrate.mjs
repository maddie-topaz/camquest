// Creates the game persistence tables. Safe to re-run.
//
// The save file is an event log (game_events) plus a snapshot (game_saves);
// see lib/game/store.ts. The older quest_completions / inventory_* tables
// are kept only as the source for the one-time backfill below.
//
// Usage:
//   pnpm db:migrate        local Docker Postgres (.env.docker)
//   pnpm db:migrate:rds    the real RDS database (.env.local, IAM auth)
//
// or directly: node --env-file=<env file> scripts/migrate.mjs

import { Pool } from "pg";
import { databasePoolConfig, isLocalDatabase } from "../lib/db-pool.mjs";

const pool = new Pool({ ...databasePoolConfig(), max: 1 });
const target = isLocalDatabase()
  ? process.env.DATABASE_URL
  : `${process.env.PGHOST} (IAM auth)`;
console.log(`Migrating ${target}`);

const sql = `
  BEGIN;

  CREATE TABLE IF NOT EXISTS quest_completions (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS quest_completions_slug_completed_at_idx
    ON quest_completions (slug, completed_at DESC);

  CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    unlock_hint TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    tilt TEXT NOT NULL DEFAULT '0deg',
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS player_inventory (
    item_id TEXT PRIMARY KEY REFERENCES inventory_items(id),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS inventory_events (
    id BIGSERIAL PRIMARY KEY,
    item_id TEXT NOT NULL REFERENCES inventory_items(id),
    delta INTEGER NOT NULL CHECK (delta <> 0),
    event_type TEXT NOT NULL CHECK (event_type IN ('grant', 'consume')),
    reason TEXT NOT NULL,
    quest_slug TEXT,
    event_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS inventory_events_item_created_at_idx
    ON inventory_events (item_id, created_at DESC);

  -- A grant sits in the player's "new items" reveal until they press Accept,
  -- which stamps it. Consume events are stamped on insert; there's nothing
  -- to accept.
  ALTER TABLE inventory_events ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
  UPDATE inventory_events SET accepted_at = created_at
  WHERE accepted_at IS NULL AND event_type = 'consume';

  CREATE INDEX IF NOT EXISTS inventory_events_pending_idx
    ON inventory_events (created_at) WHERE accepted_at IS NULL;

  -- ---------------------------------------------------------------------
  -- Game save: append-only event log + materialised snapshot.
  -- See lib/game/store.ts.
  -- ---------------------------------------------------------------------

  CREATE TABLE IF NOT EXISTS game_events (
    id BIGSERIAL PRIMARY KEY,
    player_id TEXT NOT NULL,
    seq BIGINT NOT NULL,
    event_key TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (player_id, seq),
    UNIQUE (player_id, event_key)
  );

  CREATE TABLE IF NOT EXISTS game_saves (
    player_id TEXT PRIMARY KEY,
    state JSONB NOT NULL,
    last_seq BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  -- One-time backfill from the pre-event-log tables, so Cam's history
  -- survives the switch. Every row is keyed, so re-running is a no-op.
  -- Order: player, grants (oldest first), acceptances, completions.
  WITH numbered AS (
    SELECT * FROM (
      SELECT 'player:created' AS event_key,
             jsonb_build_object('type', 'player.created', 'name', 'Cam') AS payload,
             '1970-01-01'::timestamptz AS created_at, 0 AS ord
      UNION ALL
      SELECT COALESCE(event_key, 'legacy:grant:' || id::text),
             jsonb_build_object('type', 'item.granted', 'itemId', item_id, 'quantity', delta, 'reason', reason, 'questSlug', quest_slug),
             created_at, 1
      FROM inventory_events WHERE event_type = 'grant' AND delta > 0
      UNION ALL
      SELECT COALESCE(event_key, 'legacy:consume:' || id::text),
             jsonb_build_object('type', 'item.consumed', 'itemId', item_id, 'quantity', -delta, 'reason', reason, 'questSlug', quest_slug),
             created_at, 1
      FROM inventory_events WHERE event_type = 'consume' AND delta < 0
      UNION ALL
      SELECT 'legacy:accept:' || id::text,
             jsonb_build_object('type', 'grants.accepted', 'grantKeys', jsonb_build_array(COALESCE(event_key, 'legacy:grant:' || id::text))),
             accepted_at, 2
      FROM inventory_events WHERE event_type = 'grant' AND accepted_at IS NOT NULL
      UNION ALL
      SELECT 'legacy:completion:' || id::text,
             jsonb_build_object('type', 'quest.completed', 'slug', slug, 'answers', answers),
             completed_at, 3
      FROM quest_completions
    ) AS legacy
    WHERE NOT EXISTS (SELECT 1 FROM game_events WHERE game_events.player_id = 'cam')
  ), ordered AS (
    SELECT event_key, payload, created_at,
           ROW_NUMBER() OVER (ORDER BY ord, created_at, event_key) AS seq
    FROM numbered
  )
  INSERT INTO game_events (player_id, seq, event_key, payload, created_at)
  SELECT 'cam', seq, event_key, payload, created_at FROM ordered
  ON CONFLICT (player_id, event_key) DO NOTHING;

  COMMIT;
`;

try {
  await pool.query(sql);
  console.log(
    "✓ Game persistence tables, starter inventory, and the event log are ready.",
  );
} catch (error) {
  console.error("✗ Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
