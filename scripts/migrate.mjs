// Creates the game persistence tables and starter inventory. Safe to re-run.
//
// Usage:
//   node --env-file=.env.local scripts/migrate.mjs

import { awsCredentialsProvider } from "@vercel/functions/oidc";
import { Signer } from "@aws-sdk/rds-signer";
import { Pool } from "pg";

const signer = new Signer({
  hostname: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  username: process.env.PGUSER,
  region: process.env.AWS_REGION,
  credentials: awsCredentialsProvider({
    roleArn: process.env.AWS_ROLE_ARN,
    clientConfig: { region: process.env.AWS_REGION },
  }),
});

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  database: process.env.PGDATABASE || "postgres",
  password: () => signer.getAuthToken(),
  port: Number(process.env.PGPORT),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

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

  -- Retired items. Remove their ledger and pack rows first so the
  -- foreign keys let us drop the item definitions.
  DELETE FROM inventory_events
  WHERE item_id IN ('player-two-key', 'arcade-token', 'emergency-glitter', 'mystery-cassette',
                  'lucky-d6', 'ktown-matchbook', 'last-call-coaster');
  DELETE FROM player_inventory
  WHERE item_id IN ('player-two-key', 'arcade-token', 'emergency-glitter', 'mystery-cassette',
                  'lucky-d6', 'ktown-matchbook', 'last-call-coaster');
  DELETE FROM inventory_items
  WHERE id IN ('player-two-key', 'arcade-token', 'emergency-glitter', 'mystery-cassette',
                  'lucky-d6', 'ktown-matchbook', 'last-call-coaster');

  INSERT INTO inventory_items (id, name, description, unlock_hint, icon, color, tilt, sort_order)
  VALUES
    ('vip-wristband', 'VIP wristband', 'Access all areas. Nobody has said which areas.', 'Starter item', 'Ticket', '#ffd166', '-12deg', 10),
    ('cowbell', 'Cowbell', 'The prescription was more of this.', 'Starter item', 'Bell', '#55e7ff', '8deg', 20),
    ('kitanas-blessing', 'Kitana''s Blessing', 'A lucky cat relic. The paw still waves.', 'Starter item', 'Cat', '#ff75c8', '-5deg', 30),
    ('biltong-fragment', 'Biltong fragment', 'Cured, dried, and somehow still going.', 'Starter item', 'Beef', '#d9a066', '6deg', 35)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    unlock_hint = EXCLUDED.unlock_hint,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    tilt = EXCLUDED.tilt,
    sort_order = EXCLUDED.sort_order;

  WITH starter_items(item_id, quantity, event_key) AS (
    VALUES
      ('vip-wristband', 1, 'starter:vip-wristband'),
      ('cowbell', 1, 'starter:cowbell'),
      ('kitanas-blessing', 1, 'starter:kitanas-blessing'),
      ('biltong-fragment', 1, 'starter:biltong-fragment')
  ), recorded AS (
    INSERT INTO inventory_events (item_id, delta, event_type, reason, event_key)
    SELECT item_id, quantity, 'grant', 'starter_loadout', event_key FROM starter_items
    ON CONFLICT (event_key) DO NOTHING
    RETURNING item_id, delta
  )
  INSERT INTO player_inventory (item_id, quantity)
  SELECT item_id, delta FROM recorded
  ON CONFLICT (item_id) DO UPDATE
  SET quantity = player_inventory.quantity + EXCLUDED.quantity,
      updated_at = now();

  COMMIT;
`;

try {
  await pool.query(sql);
  console.log("✓ Game persistence tables and starter inventory are ready.");
} catch (error) {
  console.error("✗ Migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
