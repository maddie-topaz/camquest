# camquest

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_T1rjI9dCClx7CfXME6dnDgJjTcsV)

## Getting Started

You need Docker Desktop running. Then:

```bash
pnpm dev
```

This starts a local Postgres container, runs the migrations, and starts the
Next.js dev server against it. Open [http://localhost:3000](http://localhost:3000)
with your browser to see the result.

## Local database

Development runs against a Postgres container defined in `docker-compose.yml`,
so you can try things without touching the real save. The app finds it via
`DATABASE_URL` in `.env.docker`; when that variable is absent, `lib/db.ts`
falls back to the AWS RDS database with IAM auth (see `lib/db-pool.mjs`).

Connection details, for `psql` or a GUI client:

| Field    | Value       |
| -------- | ----------- |
| Host     | `localhost` |
| Port     | `5440`      |
| Database | `camquest`  |
| User     | `camquest`  |
| Password | `camquest`  |
| SSL      | off         |

URL: `postgres://camquest:camquest@localhost:5440/camquest`

Port 5440 rather than 5432 so it doesn't collide with other Postgres
instances on the machine. Data lives in the `camquest-pgdata` Docker volume
and survives restarts.

### Commands

| Command               | What it does                                                    |
| --------------------- | --------------------------------------------------------------- |
| `pnpm dev`            | Start the container, migrate, run Next against the local DB     |
| `pnpm db:up`          | Start the container on its own (waits until it's healthy)       |
| `pnpm db:down`        | Stop the container (data is kept)                               |
| `pnpm db:reset`       | Wipe the local data and re-migrate — a fresh save               |
| `pnpm db:migrate`     | Run `scripts/migrate.mjs` against the local DB (safe to re-run) |
| `pnpm db:sync`        | Copy every table from RDS into the local DB                     |
| `pnpm db:psql`        | Open a `psql` shell inside the container                        |

### Getting Cam's real data locally

```bash
pnpm db:sync
```

Pulls all rows from RDS into the local database in one transaction and
resets the serial sequences. It truncates the local tables first and refuses
to run against any host other than `localhost`. Needs `.env.local` (run
`pnpm dev:rds` once, or `vercel env pull .env.local`) for the RDS credentials.

### Talking to RDS instead

```bash
pnpm dev:rds          # pulls env from Vercel, then next dev against RDS
pnpm db:migrate:rds   # run migrations on RDS
```

`scripts/db-token.mjs` prints a 15-minute IAM token to use as the password
when connecting to RDS from a GUI client.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.
