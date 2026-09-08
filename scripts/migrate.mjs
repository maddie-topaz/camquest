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

  INSERT INTO inventory_items (id, name, description, unlock_hint, icon, color, tilt, sort_order)
  VALUES
    ('player-two-key', 'Player Two key', 'Opens one door. Which one? Classified.', 'Starter item', 'KeyRound', '#ffd166', '-12deg', 10),
    ('arcade-token', 'Arcade token', 'Still warm from the machine.', 'Starter item', 'CircleDot', '#55e7ff', '8deg', 20),
    ('emergency-glitter', 'Emergency glitter', 'For low-morale encounters.', 'Starter item', 'Sparkles', '#ff75c8', '-5deg', 30),
    ('lucky-d6', 'Lucky D6', 'Fate is a little easier to carry.', 'Complete Cam''s Gambit to find it.', 'Dice5', '#b99cff', '10deg', 40),
    ('ktown-matchbook', 'K-Town matchbook', 'One spark left. Save it for dramatic effect.', 'Complete Cam''s Gambit to find it.', 'Flame', '#ff8e68', '-8deg', 50),
    ('last-call-coaster', 'Last-call coaster', 'Proof the final portal was real.', 'Complete Cam''s Gambit to find it.', 'Martini', '#7dffad', '6deg', 60)
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
      ('player-two-key', 1, 'starter:player-two-key'),
      ('arcade-token', 2, 'starter:arcade-token'),
      ('emergency-glitter', 1, 'starter:emergency-glitter')
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

  WITH completed_gambit_rewards(item_id, quantity, quest_slug, event_key) AS (
    SELECT reward.item_id, reward.quantity, 'cams-gambit', reward.event_key
    FROM (
      VALUES
        ('lucky-d6', 1, 'quest:cams-gambit:reward:lucky-d6'),
        ('ktown-matchbook', 1, 'quest:cams-gambit:reward:ktown-matchbook'),
        ('last-call-coaster', 1, 'quest:cams-gambit:reward:last-call-coaster')
    ) AS reward(item_id, quantity, event_key)
    WHERE EXISTS (SELECT 1 FROM quest_completions WHERE slug = 'cams-gambit')
  ), recorded_rewards AS (
    INSERT INTO inventory_events (item_id, delta, event_type, reason, quest_slug, event_key)
    SELECT item_id, quantity, 'grant', 'quest_complete', quest_slug, event_key
    FROM completed_gambit_rewards
    ON CONFLICT (event_key) DO NOTHING
    RETURNING item_id, delta
  )
  INSERT INTO player_inventory (item_id, quantity)
  SELECT item_id, delta FROM recorded_rewards
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
