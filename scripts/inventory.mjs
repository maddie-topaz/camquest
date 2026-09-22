// Gift items to Cam and manage the START reveal. Every grant lands as a
// pending inventory event; it shows in the reveal until Accept is pressed.
//
// Usage:
//   node --env-file=.env.local scripts/inventory.mjs list
//   node --env-file=.env.local scripts/inventory.mjs grant <itemId> [quantity] [reason]
//   node --env-file=.env.local scripts/inventory.mjs reset-accept
//
// Item definitions live in scripts/migrate.mjs; add a row there and re-run
// the migration before granting a brand-new item.

import { randomUUID } from "node:crypto";
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

const usage = () => {
  console.error(`Usage:
  inventory.mjs list
  inventory.mjs grant <itemId> [quantity=1] [reason=gift]
  inventory.mjs reset-accept`);
  process.exitCode = 1;
};

const list = async () => {
  const items = await pool.query(
    `SELECT items.id, items.name, COALESCE(pack.quantity, 0)::int AS quantity,
            COUNT(events.id) FILTER (WHERE events.event_type = 'grant' AND events.accepted_at IS NULL)::int AS pending
     FROM inventory_items AS items
     LEFT JOIN player_inventory AS pack ON pack.item_id = items.id
     LEFT JOIN inventory_events AS events ON events.item_id = items.id
     GROUP BY items.id, items.name, items.sort_order, pack.quantity
     ORDER BY items.sort_order, items.id`,
  );
  for (const row of items.rows) {
    const pending = row.pending ? `  (${row.pending} pending accept)` : "";
    console.log(`${row.id.padEnd(20)} ${row.name.padEnd(20)} x${row.quantity}${pending}`);
  }
};

const grant = async (itemId, quantityArg = "1", reason = "gift") => {
  const quantity = Number(quantityArg);
  if (!itemId || !Number.isInteger(quantity) || quantity < 1) return usage();

  const item = await pool.query(`SELECT name FROM inventory_items WHERE id = $1`, [itemId]);
  if (!item.rows[0]) {
    console.error(`✗ No item with id "${itemId}". Add it to scripts/migrate.mjs and re-run the migration first.`);
    process.exitCode = 1;
    return;
  }

  // A fresh key per invocation: running the command twice is two gifts.
  const eventKey = `gift:${randomUUID()}`;
  await pool.query(
    `WITH granted AS (
       INSERT INTO inventory_events (item_id, delta, event_type, reason, event_key)
       VALUES ($1, $2, 'grant', $3, $4)
       RETURNING item_id, delta
     )
     INSERT INTO player_inventory (item_id, quantity)
     SELECT item_id, delta FROM granted
     ON CONFLICT (item_id) DO UPDATE
     SET quantity = player_inventory.quantity + EXCLUDED.quantity,
         updated_at = now()`,
    [itemId, quantity, reason, eventKey],
  );
  console.log(`✓ Granted ${quantity} × ${item.rows[0].name}. It will show in the next START reveal.`);
};

const resetAccept = async () => {
  const result = await pool.query(
    `UPDATE inventory_events SET accepted_at = NULL WHERE event_type = 'grant'`,
  );
  console.log(`✓ Re-armed ${result.rowCount} grant(s). The next START replays the full reveal.`);
};

const [command, ...args] = process.argv.slice(2);
try {
  if (command === "list") await list();
  else if (command === "grant") await grant(...args);
  else if (command === "reset-accept") await resetAccept();
  else usage();
} catch (error) {
  console.error("✗ Failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
