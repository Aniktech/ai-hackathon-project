# Store Coach

**Retail Performance Intelligence Platform** for Vedant Fashions Limited · AI Hackathon 2026

Store Coach is designed to help retail teams understand why performance is changing and what they can do next. It focuses on three business outcomes: more bills from store footfall, bigger baskets through relevant cross-selling, and more repeat purchases from customers who return at least 30 days after their first bill.

The app includes a branded executive overview, working database-backed views across the Store Coach modules, a Prisma/PostgreSQL data model, deterministic performance calculations, protected dataset validation/import, scheduled analysis, and recommendation follow-up tracking. The provided synthetic VFL dataset is kept in `data/source/` and is loaded into the configured Neon database. The participant brief is a guide; its example values are not used as findings.

## Features

- Branded Store Coach workspace and responsive application layout
- Database-backed executive, area manager, store, salesperson, stock, retention, recommendation, weekly review, and data quality views
- Executive overview organized around the three retail performance levers
- Prisma/PostgreSQL schema for source entities, peer analysis dimensions, and source-row-preserving configuration records
- XLSX workbook and multi-file CSV validation before database writes; imports refuse to overwrite existing store or bill data
- Deterministic conversion, items-per-bill, 30+ day customer repeat, and city/tier peer opportunity calculations
- Same-store, city, and state salesperson benchmarks with quantified coaching cards and optional Gemini personalization based only on aggregate metrics
- Category-pair attachment rates (such as Sherwani with Mojari or Safa) compared with city/tier peers, with a clearly labelled opportunity estimate
- Week-over-week store signals that distinguish a broad city/tier slowdown from stable-footfall bill declines, plus peak-day roster context
- Aggregate re-engagement counts for prior wedding-date buyers, without exposing customer identities
- Stock availability signals based on recent sales pace, on-hand stock, and incoming units
- Protected daily analysis endpoint with weekly manager caps and measured recommendation follow-up
- Explicit empty states while source data is not connected
- Privacy-safe environment variable template and ignore rules

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript |
| Styling | Tailwind CSS 4 with project design tokens |
| Business logic | TypeScript and PostgreSQL calculations |
| Database and ORM | PostgreSQL and Prisma ORM 7 |
| AI explanations | Google Gemini API (optional server-side configuration) |
| Hosting | Vercel with Neon or Supabase PostgreSQL |

Business metrics and revenue impact must come from verified application logic. Gemini is reserved for explaining findings and writing concise coaching recommendations; it must not calculate KPIs or rank performance.

## Requirements

- Node.js 20.9 or newer
- npm
- The synthetic VFL CSV dataset is included under `data/source/`

## Installation

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The overview shows empty states until a validated dataset is available.

## Environment variables

Set these values in `.env.local` for local development. Never put real credentials in `.env.example` or commit `.env.local`:

```text
DATABASE_URL
DATABASE_URL_POOLED (recommended for Vercel runtime)
GEMINI_API_KEY
GEMINI_MODEL
DATA_IMPORT_TOKEN
CRON_SECRET
```

Copy `.env.example` to `.env.local` if needed. Set `DATABASE_URL` to the direct PostgreSQL URL; Prisma migrations and the local dataset importer use it. For Vercel, also set `DATABASE_URL_POOLED` to the Neon pooled URL (the hostname includes `-pooler`) for app traffic. The runtime prefers the pooled URL and falls back to `DATABASE_URL`. Add a Gemini key from Google AI Studio only if you want AI explanations; Gemini is optional and must only explain findings already calculated by application logic. The import token protects the workbook write route; the cron secret protects scheduled analysis. Keep all of these values server-side.

### Load the dataset once

Before sharing a deployment with judges, an operator imports the real `.xlsx` workbook once from **Data Quality & Monitoring**, or runs the streaming CSV-bundle importer locally:

```bash
npm run db:import -- data/source
```

CSV filenames must match source tab names (for example, `bill_lines.csv`). Validate the workbook, review row counts, and then import. Both paths refuse to overwrite existing store/bill data. Judges only open the app; they do not upload the dataset. Their pages read the imported database while Vercel runs the protected daily analysis on schedule.

Prisma commands read `DATABASE_URL` from `.env.local`. Once a development PostgreSQL database is available, generate and validate the Prisma client and schema:

```bash
npm run db:generate
npm run db:validate
```

Apply schema migrations after a development database URL is configured:

```bash
npm run db:migrate
```

The configuration sheets whose column definitions are incomplete in the participant brief (`rules`, `min_display`, and `lead_times`) are preserved as JSON rows. The initial schema and additive recommendation/packaging migrations are applied to the configured Neon database. The app uses only the supplied synthetic source dataset and never substitutes brief examples for imported rows.

## Deployment

The planned hosting target is Vercel:

1. Import this GitHub repository into Vercel.
2. Keep the Next.js framework preset and default build settings.
3. Add `DATABASE_URL` (direct URL) and `DATABASE_URL_POOLED` (Neon pooled URL) for Production. Add `DATA_IMPORT_TOKEN` and `CRON_SECRET`; add `GEMINI_API_KEY` only if enabling AI explanations. Configure variables in Preview too if you expect preview deployments to show data.
4. Use the same Neon database branch that already contains the migrated and imported dataset. If using an empty database instead, set `DATABASE_URL` locally and run `npm run db:migrate` followed by `npm run db:import -- data/source` before deploying.
5. Redeploy after adding or changing environment variables, then confirm the overview reports verified data. If it reports a database connection issue, check that `DATABASE_URL_POOLED` is the Neon pooled connection string and that it points to the populated branch.

The interface can start without a Gemini key, but data views require a migrated database and imported source rows. The included `vercel.json` schedules analysis for 08:00 India Standard Time. Set `CRON_SECRET` in Vercel so the scheduled route is authorized. Large dataset imports should use the local streaming CLI against the target database rather than a Vercel function upload.
