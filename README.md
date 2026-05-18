# yah · Household Finance Manager Scaffold

This repository now contains three concrete foundations for the MVP:

- a **Next.js web scaffold** for the future household finance UI
- a **Python FinTS spike** for testing real DKB connectivity
- a **PostgreSQL + Prisma + Docker stack** for portable deployment on another server

## Current product direction

The MVP remains focused on:
- a private self-hosted household finance manager
- DKB only for the first bank integration
- shared plus personal accounts for two people
- rule-based transaction categorization
- dashboard and reporting after import works reliably

---

## 1. Run the live DKB connection test

1. Copy `.env.dkb.local.example` to `.env.dkb.local`
2. Fill in your real DKB FinTS credentials
3. Run:

```bash
cd /home/pi/.hermes/hermes-agent/scratch/household-finance
npm run dkb:test
```

The script will:
- bootstrap available TAN mechanisms
- list discovered accounts
- fetch balances
- try recent transactions
- prompt for a TAN if required

If DKB blocks or rejects the FinTS path, the fallback for MVP remains DKB export ingestion.

---

## 2. Local app checks

### Frontend / TypeScript tests
```bash
npm test
```

### Python spike tests
```bash
npm run py:test
```

### Lint
```bash
npm run lint
```

### Production build
```bash
npm run build
```

---

## 3. Prisma + PostgreSQL model layer

The repository now includes:
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/lib/db/prisma.ts`

### Prisma commands
```bash
npm run prisma:validate
npm run prisma:generate
npm run prisma:db:push
npm run prisma:seed
```

### Database env template
Copy the example env file if you want to run Prisma locally outside Docker:

```bash
cp .env.example .env
```

Important variables:
- `DATABASE_URL`
- `DIRECT_DATABASE_URL`
- `SHADOW_DATABASE_URL`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`
- `POSTGRES_SHADOW_DB`

---

## 4. Docker deployment

This project is prepared as a **portable Docker Compose stack** with:
- `app` → Next.js application container
- `postgres` → PostgreSQL 16 container

### Files
- `Dockerfile`
- `.dockerignore`
- `docker-compose.yml`
- `.env.example`

### Start the full stack
```bash
cd /home/pi/.hermes/hermes-agent/scratch/household-finance
cp .env.example .env
cp .env.dkb.local.example .env.dkb.local   # optional, for later live DKB test use

docker compose up --build
```

The app container starts by running:
1. `npm run prisma:generate`
2. `npm run prisma:db:push`
3. `npm run start`

### Ports
- App: `http://localhost:3000`
- Postgres: `localhost:5432`

### Persistent data
Postgres data is stored in the named Docker volume:
- `postgres_data`

That makes moving the stack to another server straightforward:
- copy the repo
- copy the env files
- bring up the compose stack
- optionally restore the database dump into the Postgres service

---

## 5. Notes

- The DKB endpoint is currently configured as `https://banking-dkb.s-fints-pt-dkb.de/fints30`
- A previous probe confirmed this endpoint responds over HTTPS from this machine
- The current connector abstraction intentionally stops short of pretending the live bank integration is done before the evening test confirms it
- The Prisma schema already models the main household-finance domain: users, households, memberships, bank connections, accounts, balances, transactions, categories, rules, sync runs, and audit events
