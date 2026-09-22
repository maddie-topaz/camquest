// Builds the pg Pool config for whichever database the environment points
// at. Shared by the app (lib/db.ts) and the CLI scripts so they can't drift.
//
//   DATABASE_URL set  → plain password auth, no TLS. This is the local Docker
//                       Postgres from docker-compose.yml; .env.docker holds
//                       the URL.
//   otherwise         → AWS RDS with IAM auth. Vercel OIDC → assumed role →
//                       short-lived token used as the password. The PG* and
//                       AWS_* vars come from `vercel env pull`.

import { awsCredentialsProvider } from "@vercel/functions/oidc";
import { Signer } from "@aws-sdk/rds-signer";

// IAM auth tokens are valid for 15 minutes, but signer.getAuthToken() doesn't
// cache on its own — called fresh, it re-runs the AWS credential exchange
// every time. Cache the token in-process and reuse it for any new
// connection the pool opens within that window, refreshing a minute early
// for safety.
const AUTH_TOKEN_TTL_MS = 14 * 60 * 1000;

const createIamPasswordProvider = () => {
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

  /** @type {{ value: string; expiresAt: number } | null} */
  let cachedToken = null;

  return async () => {
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
      return cachedToken.value;
    }
    const value = await signer.getAuthToken();
    cachedToken = { value, expiresAt: Date.now() + AUTH_TOKEN_TTL_MS };
    return value;
  };
};

export const isLocalDatabase = () => Boolean(process.env.DATABASE_URL);

/** @returns {import("pg").PoolConfig} */
export const databasePoolConfig = () => {
  if (process.env.DATABASE_URL) {
    // `ssl: false` explicitly, because pg otherwise honours the PGSSLMODE
    // that `vercel env pull` leaves in .env.local, and the local container
    // doesn't speak TLS.
    return { connectionString: process.env.DATABASE_URL, ssl: false };
  }
  return {
    host: process.env.PGHOST,
    user: process.env.PGUSER,
    database: process.env.PGDATABASE || "postgres",
    password: createIamPasswordProvider(),
    port: Number(process.env.PGPORT),
    // Recommended to switch to `true` in production.
    // See https://docs.aws.amazon.com/lambda/latest/dg/services-rds.html#rds-lambda-certificates
    ssl: { rejectUnauthorized: false },
  };
};
