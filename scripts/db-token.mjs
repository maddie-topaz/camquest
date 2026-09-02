// Prints a fresh IAM auth token to use as the "password" when connecting
// to the Postgres DB from a GUI client (TablePlus, DBeaver, DataGrip, etc).
// Token is valid for ~15 minutes.
//
// Usage:
//   node --env-file=.env.local scripts/db-token.mjs

import { awsCredentialsProvider } from "@vercel/functions/oidc";
import { Signer } from "@aws-sdk/rds-signer";

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

const token = await signer.getAuthToken();
console.log(token);
