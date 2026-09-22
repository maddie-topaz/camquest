import { attachDatabasePool } from "@vercel/functions";
import { ClientBase, Pool } from "pg";
import { databasePoolConfig } from "./db-pool.mjs";

// Which database this talks to (local Docker vs. RDS with IAM auth) is
// decided by the environment; see lib/db-pool.mjs.
const pool = new Pool({
  ...databasePoolConfig(),
  max: 20,
  // node-postgres's default idleTimeoutMillis (10s) closes a connection
  // almost as soon as a request finishes, which meant nearly every request
  // paid for a brand new IAM handshake (AWS credential exchange + SigV4
  // signing + a fresh TLS connection to RDS). Keep connections around for
  // 10 minutes of inactivity instead, well inside the 15-minute auth token
  // lifetime, so normal usage reuses an already-authenticated connection.
  idleTimeoutMillis: 10 * 60 * 1000,
  // `min` alone doesn't make node-postgres proactively open connections —
  // it only stops the pool from evicting clients below this count once
  // they exist. The warm-up query below is what actually creates the
  // first one; this just keeps it from being reclaimed.
  min: 1,
  // TCP-level keepalive so a connection idling across the WAN to RDS
  // doesn't get silently dropped by a router/NAT before idleTimeoutMillis
  // would have closed it anyway.
  keepAlive: true,
});

attachDatabasePool(pool);

// Open one connection as soon as this module loads (server startup, or the
// first request in a dev/cold environment) instead of waiting for the
// first real query to pay the IAM auth cost.
pool.query("SELECT 1").catch((error) => {
  console.error("Failed to warm up the database connection pool", error);
});

// Single query transaction.
export async function query(sql: string, args: unknown[]) {
  return pool.query(sql, args);
}

// Use it for multiple queries transaction.
export async function withConnection<T>(
  fn: (client: ClientBase) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
