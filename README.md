# YAYCSA

Local food marketplace connecting farms, restaurants, grocery stores, and distributors with wholesale buyers. Multi-vendor from day one.

## Stack

| Layer | Tech |
|---|---|
| Backend | [Vendure](https://vendure.io) (Node.js e-commerce framework) |
| Frontend | [SvelteKit](https://kit.svelte.dev) + Svelte 5 |
| Database | [Supabase](https://supabase.com) cloud Postgres (Supabase session pooler, IPv4) |
| UI components | [shadcn-svelte](https://shadcn-svelte.com) + Tailwind CSS v4 |
| GraphQL client | [gql.tada](https://gql-tada.0no.co) (compile-time type-safe, no codegen step) |
| Testing | [Playwright](https://playwright.dev) |
| Planning AI | Wally (Opus 4.6, accessed via Discord) |

## Monorepo structure

```
apps/
  server/      — Vendure backend (port 3000, admin dashboard port 3001)
  storefront/  — SvelteKit frontend (port 5180)
  docs/        — shared git submodule: architecture docs + project todo
```

`apps/docs/` is a shared submodule — Joe plans features with Wally on Discord, results get distilled into the docs here. These are the single source of truth for architecture and feature specs.

## Dev setup

```bash
# Install dependencies
npm install

# Start both servers (concurrently)
npm run dev
```

**First time only** — set up Playwright test browser:

```bash
cd apps/storefront
npm install
npx playwright install chromium
```

## Running tests

Requires both servers running (`npm run dev`). The suite creates and deletes its own test user via the Vendure Admin API — no credentials needed.

```bash
# From apps/storefront/
npx playwright test          # full regression suite
npx playwright test --ui     # interactive UI mode
npx playwright test auth     # specific spec file

# Or from the monorepo root
npm run test -w storefront
```

## Docs submodule

Pull latest before starting work:

```bash
cd apps/docs && git pull origin main && cd ../..
```

Key locations:
- `apps/docs/library/yaycsa/vision.md` — project vision + feature index
- `apps/docs/library/yaycsa/features/` — feature specs
- `apps/docs/library/yaycsa/plugins/` — plugin specs
- `apps/docs/todos/yaycsa.md` — project todo / phase tracker

Push after updating docs:

```bash
cd apps/docs && git add -A && git commit -m "Update: ..." && git push && cd ../..
```

## Vendure

```bash
# Run Vendure CLI commands from apps/server/
cd apps/server && npx vendure <command>

# Admin login
# http://localhost:3001 — superadmin / superadmin
```

## Schema codegen (storefront)

Run after changing GraphQL queries or when the Vendure schema changes:

```bash
cd apps/storefront && npm run generate-schema
```
