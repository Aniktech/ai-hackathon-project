# Store Coach

**Retail Performance Intelligence Platform** for Vedant Fashions Limited · AI Hackathon 2026

Store Coach is designed to help retail teams understand why performance is changing and what they can do next. It focuses on three business outcomes: more bills from store footfall, bigger baskets through relevant cross-selling, and more repeat purchases from customers who return at least 30 days after their first bill.

The app now includes the branded executive overview, working navigation across the planned modules, and a PostgreSQL/Prisma data model for the entities described in the participant brief. It intentionally shows no operational results until the actual hackathon workbook or CSV data is connected and validated. The brief describes the data but is not the dataset; its example values are synthetic.

## Features

- Branded Store Coach workspace and responsive application layout
- Working navigation across executive, area manager, store, salesperson, recommendation, stock, retention, weekly review, and data quality views
- Executive overview organized around the three retail performance levers
- Prisma/PostgreSQL schema for source entities, peer analysis dimensions, and source-row-preserving configuration records
- Explicit empty states while source data is not connected
- Privacy-safe environment variable template and ignore rules

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript |
| Styling | Tailwind CSS 4 with project design tokens |
| Business logic (planned) | TypeScript and validated SQL calculations |
| Database and ORM | PostgreSQL and Prisma ORM 7 |
| AI explanations (planned) | Google Gemini API, for explanations and coaching language |
| Validation (planned) | Zod |
| Hosting (planned) | Vercel with Neon or Supabase PostgreSQL |

Business metrics and revenue impact must come from verified application logic. Gemini is reserved for explaining findings and writing concise coaching recommendations; it must not calculate KPIs or rank performance.

## Requirements

- Node.js 20.9 or newer
- npm
- The actual hackathon workbook or its CSV export for data features (not included in this repository yet)

## Installation

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The initial overview will show empty states until a validated dataset is available.

## Environment variables

The current foundation does not require environment variables. Later database and Gemini integration is expected to use:

```text
DATABASE_URL
GEMINI_API_KEY
```

Copy `.env.example` to `.env.local` when those integrations are implemented, then replace the placeholders with your own values. Keep `.env.local` private; real credentials must never be committed or exposed in client-side code.

Prisma commands read `DATABASE_URL` from `.env.local`. Once a development PostgreSQL database is available, generate and validate the Prisma client and schema:

```bash
npm run db:generate
npm run db:validate
```

Apply schema migrations only after a development database URL is configured:

```bash
npm run db:migrate
```

The configuration sheets whose column definitions are incomplete in the participant brief (`rules`, `min_display`, and `lead_times`) are preserved as JSON rows until the actual workbook confirms their exact fields. No migration has been applied because no database credentials or source workbook have been provided.

## Deployment

The planned hosting target is Vercel:

1. Import this GitHub repository into Vercel.
2. Keep the Next.js framework preset and default build settings.
3. Add production environment variables in the Vercel project settings only after the database and Gemini integrations are implemented.
4. Deploy and confirm the production overview loads.

The current shell can be deployed without a database or Gemini key. Data processing, KPI calculations, recommendations, scheduled analysis, and production verification are planned follow-on phases.
