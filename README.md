# techdex
Inventory for tech devices in the company.

Track every device: who has it, their job title and location, its condition, and a dated history of
everything that happened to it (bought, assigned, returned, repaired, notes).

## Stack
Next.js 15 (App Router, Server Actions) · TypeScript · Prisma 6 + SQLite · Auth.js v5 · Tailwind + shadcn/ui · Vitest

## Getting started
```bash
npm install
cp .env.example .env          # then set AUTH_SECRET (npx auth secret) and seed passwords
npm run db:migrate            # creates prisma/dev.db
npm run db:seed               # admin + viewer accounts, categories, sample data
npm run dev                   # http://localhost:3000
```
Default seed accounts (change them in `.env` before seeding, or reset their passwords under **Users**):

| Role   | Email                | Password     |
|--------|----------------------|--------------|
| Admin  | `admin@example.com`  | `admin1234`  |
| Viewer | `viewer@example.com` | `viewer1234` |

## Roles
- **Admin**: create/edit/delete items, assign, return, record repairs, manage people, categories and users.
- **Viewer**: read-only access to everything except the settings pages.

Permissions are enforced in every server action (`requireAdmin()` in `src/lib/authz.ts`), not just hidden in the UI.

## Data model
- **Person**: someone who can hold equipment (name, email, active). Deactivate people who leave; their history stays.
- **Item**: asset tag, serial, category, brand/model, description, price, purchase date, current condition notes,
  status (`In use`, `In storage`, `In repair`, `Retired`) and the current assignee + job title + location.
- **ItemEvent**: the history. Each event has the real-world date it happened, notes, and for assignments a snapshot of
  the person's job title and location at that time.

All changes to status, assignee or condition go through `src/lib/inventory.ts`, which writes the event and updates the
item in a single transaction.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build && npm start` | Production build / server |
| `npm test` | Unit tests (uses a throwaway `prisma/test.db`) |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Apply / create migrations |
| `npm run db:seed` | Seed accounts, categories and sample data (sample items only on an empty DB) |
| `npm run db:studio` | Browse the database in Prisma Studio |

## Deploying (Windows Server intranet)
1. Install Node.js LTS and [NSSM](https://nssm.cc).
2. In the project folder: `npm ci`, create `.env` (set `DATABASE_URL="file:./prod.db"`, a fresh `AUTH_SECRET`,
   `AUTH_TRUST_HOST=true`, `AUTH_URL`, strong seed passwords), then
   `npx prisma migrate deploy`, `npm run db:seed` (first time only), `npm run build`.
3. Run as a service: `nssm install techdex "C:\Program Files\nodejs\npm.cmd" "start -- -p 3000"`,
   set its `AppDirectory` to the project folder, then `nssm start techdex`.
4. Expose it: open TCP 3000 in Windows Firewall, or (better) put IIS with URL Rewrite + ARR in front as a reverse
   proxy with an HTTPS certificate from your internal CA.

To update: `git pull`, `npm ci`, `npx prisma migrate deploy`, `npm run build`, `nssm restart techdex`.
Use `migrate deploy` on servers, never `migrate dev` or `migrate reset`.

## Backups
All data lives in a single SQLite file (`prisma/dev.db` locally, `prisma/prod.db` on the server). Back it up by
copying that file while the app is stopped, or with `sqlite3 prod.db ".backup backup.db"` while it runs.
