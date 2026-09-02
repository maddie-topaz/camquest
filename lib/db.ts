import { awsCredentialsProvider } from "@vercel/functions/oidc";
import { attachDatabasePool } from "@vercel/functions";
import { Signer } from "@aws-sdk/rds-signer";
import { ClientBase, Pool } from "pg";

const signer = new Signer({
  hostname: process.env.PGHOST!,
  port: Number(process.env.PGPORT),
  username: process.env.PGUSER!,
  region: process.env.AWS_REGION!,
  credentials: awsCredentialsProvider({
    roleArn: process.env.AWS_ROLE_ARN!,
    clientConfig: { region: process.env.AWS_REGION! },
  }),
});

// IAM auth tokens are valid for 15 minutes, but signer.getAuthToken() doesn't
// cache on its own — called fresh, it re-runs the AWS credential exchange
// every time. Cache the token in-process and reuse it for any new
// connection the pool opens within that window, refreshing a minute early
// for safety.
const AUTH_TOKEN_TTL_MS = 14 * 60 * 1000;
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getCachedAuthToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }
  const value = await signer.getAuthToken();
  cachedToken = { value, expiresAt: Date.now() + AUTH_TOKEN_TTL_MS };
  return value;
}

const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  database: process.env.PGDATABASE || "postgres",
  password: getCachedAuthToken,
  port: Number(process.env.PGPORT),
  // Recommended to switch to `true` in production.
  // See https://docs.aws.amazon.com/lambda/latest/dg/services-rds.html#rds-lambda-certificates
  ssl: { rejectUnauthorized: false },
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
