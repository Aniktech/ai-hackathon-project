# Store Coach

**Retail Performance Intelligence Platform**
Vedant Fashions Limited · AI Hackathon 2026

Store Coach turns retail sales, footfall, roster, inventory, and calendar data into performance views and coaching actions. It focuses on three business outcomes: more bills from store visits, bigger baskets through relevant product pairings, and more customers returning at least 30 days after their first bill.

## Project links

- **Production app:** [https://ai-hackathon-project-incw.vercel.app/](https://ai-hackathon-project-incw.vercel.app/)
- **GitHub repository:** [Aniktech/ai-hackathon-project](https://github.com/Aniktech/ai-hackathon-project)

The production app needs working Vercel database environment variables and an imported dataset. If it shows **Database unavailable**, check the configured Neon URLs. If it shows **Data required**, the database connected but has no source bills.

## What the app includes

- **Executive Overview:** bills, conversion, items per bill, repeat rate, and monthly trends.
- **Area Manager Dashboard:** up to five store or basket issues per manager per week, ranked by estimated opportunity. Conversion trends compare the latest 28 days with the previous 28 days and include city/tier context and peak-day roster signals.
- **Store Performance:** store conversion and basket comparisons with relevant city/tier peers.
- **Salesperson Performance:** bills and items per bill compared with same-store, city, and state peer averages. The metric-based coaching card is specific to the salesperson’s measured gap. **Personalize with Gemini** can rewrite the coaching suggestion using aggregate metrics only.
- **Category pairing analysis:** recent attach rates for pairings such as Sherwani with Mojari or Safa, compared with peer stores. Estimated opportunity is a planning estimate, not guaranteed revenue.
- **Customer Retention:** a 30+ day repeat definition and aggregate counts of prior wedding-date buyers who have not purchased in the latest 30 days. Customer IDs are not shown.
- **Stock Insights:** latest on-hand and incoming quantities, recent sales pace, estimated days of cover, and simple availability signals.
- **Action Recommendations and Weekly Impact Review:** daily recommendations, manager follow-up status, and manually recorded outcomes compared with the saved baseline.
- **Data Quality & Monitoring:** CSV/XLSX validation and guarded import tools. The import refuses to overwrite existing store or bill data.
- **Scheduled analysis:** Vercel Cron calls the daily analysis route at 02:30 UTC (08:00 India Standard Time).

Business metrics and opportunity calculations are performed by SQL and TypeScript. Gemini is optional and only writes short explanations or coaching suggestions from supplied aggregate metrics; it does not calculate KPIs or rank performance.

## Technology

- Next.js App Router, React, TypeScript
- Tailwind CSS 4 and project design tokens
- PostgreSQL and Prisma ORM 7 with the `pg` adapter
- Google Gemini API for optional server-side explanations and coaching
- Neon PostgreSQL and Vercel deployment
- CSV parsing and XLSX workbook validation

## Dataset

The supplied synthetic VFL dataset is included under [`data/source/`](data/source/). It contains 20 stores, 175 salespeople, 90,805 bills, and 259,772 bill lines, along with footfall, roster, stock, calendar, and configuration data. The participant brief is a data guide; its example figures are not used as findings.

Judges do not need to upload a file. The dataset should be imported once into the PostgreSQL database before the app is shared. The CSV bundle importer validates expected tables and row counts, writes in a guarded transaction, and refuses to run when store or bill data already exists.

## Requirements

- Node.js 20.9 or newer
- npm
- A PostgreSQL database for live data features (Neon is the configured provider)

## Run locally

Install dependencies:

```bash
npm install
```

Create `.env.local` from the safe template:

```bash
cp .env.example .env.local
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local` and fill in the required values described below. Then run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without a reachable database, the UI displays a connection status instead of live figures.

## Environment variables

Keep real values in `.env.local` for local work and in Vercel’s server-side Environment Variables for deployment. Never commit `.env.local`, paste database passwords or API keys into source files, or put real credentials in `.env.example`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Direct PostgreSQL URL. Prisma configuration, migrations, and the local data importer use this URL. |
| `DATABASE_URL_POOLED` | Recommended on Vercel | Neon pooled connection URL for serverless application traffic. The app uses it first and falls back to `DATABASE_URL`. |
| `DATA_IMPORT_TOKEN` | For protected import and action updates | Long, random bearer token for administrator-only import and recommendation actions. |
| `CRON_SECRET` | For scheduled analysis | Long, random bearer token used to authorize the Vercel Cron request. |
| `GEMINI_API_KEY` | Optional | Server-side Gemini key for on-demand explanation and coaching suggestions. |
| `GEMINI_MODEL` | Optional | Gemini model name; defaults to `gemini-2.5-flash`. |

For Neon, copy the **direct** connection string into `DATABASE_URL` and the **pooled** connection string into `DATABASE_URL_POOLED`. Copy both from Neon’s Connect dialog; don’t build or share them manually. `DATABASE_URL` is still required by `prisma.config.ts`, including when Prisma Client is generated during a deployment build.

Generate each token independently with a cryptographically secure random generator. Do not reuse the Gemini key as a token or share any of these values in chat or commit history.

## Database and data setup

The current production database is expected to already contain the imported dataset. If you connect an empty database, run these commands from the repository root after setting its direct URL in `.env.local`:

```bash
npm run db:validate
npm run db:migrate
npm run db:import -- data/source
```

The import command validates the CSV bundle, verifies its expected table counts, and imports it transactionally. If the database already contains stores or bills, import stops without changing rows. Do not run the import again against an already-populated database.

Other useful database commands:

```bash
npm run db:generate   # Generate Prisma Client
npm run db:validate   # Validate the Prisma schema
npm run db:format     # Format the Prisma schema
npm run lint          # Run ESLint
npm run build         # Generate Prisma Client, then build Next.js
```

The Data Quality & Monitoring page also has administrator-only validation/import tools. The project’s large CSV dataset is best imported with the local streaming CLI against the target database rather than uploaded through a serverless function.

## How key metrics work

- **Conversion:** bills divided by recorded footfall for the latest 28 days.
- **Store peers:** city and store tier comparisons; the store itself is excluded from its peer average.
- **Items per bill:** non-packaging units divided by bills.
- **Repeat rate:** distinct customers who made another bill at least 30 days after their first recorded bill, using customers with a complete observation window.
- **Category attachment:** the share of bills containing an anchor category that also contain its defined complementary category. The opportunity estimate applies the peer attach-rate gap to observed eligible bills and complementary-category revenue.
- **Trend signals:** latest 28 days compared with the immediately preceding 28 days. The app flags broad peer slowdown, stable-footfall bill declines, or a store-specific conversion decline as observed signals; these are not proof of operational cause.
- **Peak-day staffing context:** visitor load per present salesperson on high-footfall days compared with other days. This is a prompt for manager review, not a staffing prescription.
- **Stock cover:** current on-hand units divided by recent daily unit sales pace; the availability signals are simple heuristics.
- **AI coaching:** an optional button sends only aggregate bills and items-per-bill peer metrics to Gemini. It does not send employee names, customer IDs, or customer records. The resulting suggestion is limited to 60 words; without a key, a deterministic metric-based suggestion is used.

## Deploy to Vercel

The project’s production URL is [https://ai-hackathon-project-incw.vercel.app/](https://ai-hackathon-project-incw.vercel.app/).

1. Connect the GitHub repository `Aniktech/ai-hackathon-project` to a Vercel project. Use the Next.js framework preset and repository root as the project root.
2. Set the **Production** environment variables: `DATABASE_URL`, `DATABASE_URL_POOLED`, `DATA_IMPORT_TOKEN`, and `CRON_SECRET`. Add `GEMINI_API_KEY` if you want Gemini features. Add them to **Preview** too if preview deployments need database-backed content.
3. Make sure the database URLs point to the Neon branch containing the migrated and imported dataset. If the database is empty, first follow the database setup commands above.
4. Deploy, then check the deployment logs and the production URL. Confirm the overview shows verified data and test one salesperson’s Gemini coaching action if the key is configured.
5. After changing Vercel environment variables, redeploy so the new deployment receives them.

When Vercel Git integration is enabled, a push to the configured production branch (normally `main`) triggers a build and deployment. Other branches normally produce Preview deployments. Confirm the project’s Production Branch setting in Vercel if pushes do not start a deployment.

## Security and data handling

- `.env.local` and other `.env.*` files are ignored by Git; `.env.example` contains placeholders only.
- Import, cron, and recommendation-update routes require bearer tokens.
- Customer IDs are used only for server-side aggregate calculations and are not returned to the dashboard or sent to Gemini.
- Gemini API calls are made from server routes; the API key is never sent to browser code.
- Dataset imports validate IDs and source structure, and refuse to overwrite an existing populated database.

## Current scope and limitations

- Conversion, category attachment, retention, trend, and stock signals are measured from the supplied dataset. Recommendations describe signals and ask managers to validate context; they do not establish causality.
- Stock Insights currently reports availability risk and sales cover. It does **not** yet recommend store-to-store or warehouse transfers while enforcing every source rule, such as minimum display, flagship protection, donor cover, store capacity, lead time, and human approval thresholds.
- Wedding-date retention reporting is an aggregate cohort signal; the app does not send customer campaigns or reveal customer identities.
- Weekly Impact Review records a manually entered follow-up measure. It does not prove that a recommendation caused the change.
- Gemini coaching is on demand and optional. KPI calculations and opportunity rankings remain deterministic.

## Repository layout

```text
app/                 Next.js pages and API routes
components/          Dashboard, import, chart, and coaching UI
data/source/         Supplied CSV dataset
lib/                 Analytics, recommendations, Prisma, and validation logic
prisma/              Prisma schema and database migrations
scripts/             Dataset import commands
vercel.json          Daily Vercel Cron schedule
```
