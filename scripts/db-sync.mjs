// Copies every table in the RDS database into the local Docker Postgres,
// so you can poke at Cam's real save without touching production.
//
// Reads from RDS (PG* / AWS_* vars, IAM auth) and writes to DATABASE_URL,
// which must point at localhost — the script refuses anything else, since
// it truncates every table on the destination first.
//
// Usage:
//   pnpm db:sync
//   (= node --env-file=.env.local --env-file=.env.docker scripts/db-sync.mjs)
//
// Run `pnpm db:migrate` first if the local schema doesn't exist yet.

import { Pool } from "pg";
import { localPoolConfig, rdsPoolConfig } from "../lib/db-pool.mjs";

const CHUNK_ROWS = 500;

const destinationUrl = process.env.DATABASE_URL;
if (!destinationUrl) {
  console.error("✗ DATABASE_URL is not set; nothing to sync into.");
  process.exit(1);
}
const destinationHost = new URL(destinationUrl).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(destinationHost)) {
  console.error(`✗ Refusing to sync into ${destinationHost}: destination must be localhost.`);
  process.exit(1);
}
if (!process.env.PGHOST) {
  console.error("✗ PGHOST is not set; load .env.local so the RDS source is configured.");
  process.exit(1);
}

const source = new Pool({ ...rdsPoolConfig(), max: 1 });
const destination = new Pool({ ...localPoolConfig(destinationUrl), max: 1 });

const quote = (identifier) => `"${identifier.replace(/"/g, '""')}"`;

const listTables = async (client) => {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  );
  return rows.map((row) => row.table_name);
};

const insertRows = async (client, table, rows) => {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  for (let offset = 0; offset < rows.length; offset += CHUNK_ROWS) {
    const chunk = rows.slice(offset, offset + CHUNK_ROWS);
    const params = [];
    const tuples = chunk.map((row) => {
      const placeholders = columns.map((column) => {
        const value = row[column];
        // pg hands jsonb back as parsed objects; it serialises plain objects
        // on the way in, but arrays would be sent as Postgres arrays, so
        // stringify anything structured ourselves.
        params.push(value !== null && typeof value === "object" && !(value instanceof Date) ? JSON.stringify(value) : value);
        return `$${params.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });
    await client.query(
      `INSERT INTO ${quote(table)} (${columns.map(quote).join(", ")}) VALUES ${tuples.join(", ")}`,
      params,
    );
  }
};

// Bring every serial/identity sequence on the table up past the copied ids
// so new local inserts don't collide.
const resetSequences = async (client, table) => {
  const { rows } = await client.query(
    `SELECT column_name, pg_get_serial_sequence($1, column_name) AS sequence
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  for (const { column_name: column, sequence } of rows) {
    if (!sequence) continue;
    await client.query(
      `SELECT setval($1, COALESCE((SELECT MAX(${quote(column)}) FROM ${quote(table)}), 0) + 1, false)`,
      [sequence],
    );
  }
};

const sync = async () => {
  const [sourceTables, destinationTables] = await Promise.all([
    source.connect().then(async (client) => {
      try { return await listTables(client); } finally { client.release(); }
    }),
    destination.connect().then(async (client) => {
      try { return await listTables(client); } finally { client.release(); }
    }),
  ]);

  const missing = sourceTables.filter((table) => !destinationTables.includes(table));
  if (missing.length) {
    throw new Error(`Local schema is missing ${missing.join(", ")} — run \`pnpm db:migrate\` first.`);
  }

  console.log(`Syncing ${process.env.PGHOST} → ${destinationUrl}`);

  const client = await destination.connect();
  try {
    await client.query("BEGIN");
    // Skip FK checks while tables are loaded in alphabetical order; the
    // data is already consistent on the source, and the local user is the
    // container's superuser so this is allowed.
    await client.query("SET LOCAL session_replication_role = 'replica'");
    // One TRUNCATE for the lot: truncating tables one at a time trips over
    // the FKs between them even in replica mode.
    await client.query(`TRUNCATE ${sourceTables.map(quote).join(", ")}`);
    for (const table of sourceTables) {
      const { rows } = await source.query(`SELECT * FROM ${quote(table)}`);
      await insertRows(client, table, rows);
      await resetSequences(client, table);
      console.log(`  ${table.padEnd(20)} ${String(rows.length).padStart(5)} rows`);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  console.log("✓ Local database now mirrors RDS.");
};

try {
  await sync();
} catch (error) {
  console.error("✗ Sync failed:", error.message);
  process.exitCode = 1;
} finally {
  await Promise.all([source.end(), destination.end()]);
}
