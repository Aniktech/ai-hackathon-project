import Link from "next/link";
import { notFound } from "next/navigation";
import { moduleBySlug, modules } from "@/lib/navigation";
import { Icon } from "@/components/icon";
import { ImportPanel } from "@/components/import-panel";
import { getOverview } from "@/lib/analytics";
import { getSalespeople, getStockInsights, type StoreMetric } from "@/lib/analytics";
import { getRecommendationHistory } from "@/lib/recommendations";
import { RecommendationCenter, type RecommendationCard } from "@/components/recommendation-center";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return modules.map(({ slug }) => ({ section: slug }));
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const pageModule = moduleBySlug.get(section);

  if (!pageModule) notFound();

  const overview = section === "data-quality" ? await getOverview().catch(() => null) : null;
  const operating = section !== "data-quality" ? await getOverview().catch(() => null) : null;
  const currentOverview = section === "data-quality" ? overview : operating;
  const databaseReachable = currentOverview !== null;
  const hasData = Boolean(currentOverview?.available);
  const people = section === "salespeople" ? await getSalespeople().catch(() => []) : [];
  const stock = section === "stock" ? await getStockInsights().catch(() => []) : [];
  const recommendationHistory = ["weekly-review", "recommendations"].includes(section) ? await getRecommendationHistory().catch(() => []) : [];
  const recommendationCards: RecommendationCard[] = recommendationHistory.map((record) => ({
    id: record.id,
    runDate: record.runDate.toISOString().slice(0, 10),
    ownerType: record.ownerType,
    ownerId: record.ownerId,
    areaManagerName: record.areaManager.name,
    storeId: record.storeId,
    city: record.store.city,
    lever: record.lever,
    cause: record.cause,
    opportunity: Number(record.opportunity),
    action: record.action,
    baselineValue: record.baselineValue,
    outcomeValue: record.outcomeValue,
    status: record.status,
  }));
  const managerPriorities = new Map<string, StoreMetric[]>();
  for (const store of operating?.stores ?? []) {
    if (store.conversionOpportunity <= 0) continue;
    const current = managerPriorities.get(store.areaManager) ?? [];
    if (current.length < 5) managerPriorities.set(store.areaManager, [...current, store]);
  }

  return (
    <div className="page-content module-page">
      <div className="eyebrow"><span className="eyebrow-line" /> VEDANT FASHIONS LIMITED <span className="eyebrow-separator">·</span> STORE COACH</div>
      <div className="page-heading">
        <div>
          <p className="greeting">WORKSPACE MODULE</p>
          <h1>{pageModule.label}</h1>
          <p className="page-subtitle">{pageModule.description}</p>
        </div>
        <div className="data-state"><span className="state-dot" /><span><strong>{!databaseReachable ? "Database connection unavailable" : hasData ? `Data through ${currentOverview?.latestDate}` : "Dataset not imported"}</strong><small>{hasData ? "Validated source rows are available" : !databaseReachable ? "Check the deployment database connection" : "Import the validated source dataset to show metrics"}</small></span></div>
      </div>

      {section === "data-quality" ? <section className="panel data-quality-panel">
        <div className="panel-heading"><div><p className="section-kicker">DATASET STATUS</p><h2>{overview === null ? "Database connection unavailable" : overview.available ? `Imported through ${overview.latestDate}` : "No source workbook imported"}</h2></div><span className="readiness-tag">{overview === null ? "DATABASE OFFLINE" : overview.available ? "DATA LOADED" : "AWAITING DATA"}</span></div>
        <p className="import-copy">{overview?.available ? "Source data is ready. Judges can open the dashboard directly; no upload is needed." : overview === null ? "This app could not connect to the database. Check DATABASE_URL_POOLED in the deployment settings and confirm it points to the database containing the imported rows." : "The database is reachable but contains no bill data. An administrator must import the validated dataset before sharing the app."}</p>
        <details className="admin-import"><summary>Administrator dataset tools</summary><ImportPanel /></details>
      </section> : section === "area-managers" && operating?.available ? <section className="panel module-data"><div className="panel-heading"><div><p className="section-kicker">MAXIMUM FIVE PER MANAGER</p><h2>Store priorities ranked by estimated conversion opportunity</h2></div></div>{managerPriorities.size ? [...managerPriorities.entries()].map(([manager, entries]) => <div className="data-group" key={manager}><h3>{manager}</h3>{entries.map((store) => <div className="priority-row" key={store.storeId}><span><strong>{store.storeId} · {store.city}</strong><small>Conversion {formatPct(store.conversion)} vs peer {formatPct(store.peerConversion)} · verify roster and market context</small></span><b>{formatMoney(store.conversionOpportunity)}</b></div>)}</div>) : <p className="empty-note">No store is below its city and tier peer conversion in the latest 28 days.</p>}</section>
      : section === "stores" && operating?.available ? <section className="panel module-data"><div className="panel-heading"><div><p className="section-kicker">LATEST 28 DAYS · CITY AND TIER PEERS</p><h2>Store performance</h2></div><span className="source-note">Through {operating.latestDate}</span></div><div className="table-scroll"><table><thead><tr><th>Store</th><th>City / tier</th><th>Bills</th><th>Conversion</th><th>Peer</th><th>Items / bill</th><th>Revenue opportunity</th></tr></thead><tbody>{operating.stores.map((store) => <tr key={store.storeId}><td>{store.storeId}</td><td>{store.city} · {store.tier}</td><td>{store.bills.toLocaleString("en-IN")}</td><td>{formatPct(store.conversion)}</td><td>{formatPct(store.peerConversion)}</td><td>{store.itemsPerBill?.toFixed(2) ?? "—"}</td><td>{formatMoney(store.conversionOpportunity)}</td></tr>)}</tbody></table></div></section>
      : section === "salespeople" && operating?.available ? <section className="panel module-data"><div className="panel-heading"><div><p className="section-kicker">LATEST 28 DAYS · STORE, CITY AND STATE PEERS</p><h2>Salesperson performance and coaching</h2></div></div>{people.length ? <div className="table-scroll"><table><thead><tr><th>Salesperson</th><th>Store</th><th>Bills</th><th>Peer avg. bills (store / city / state)</th><th>Items per bill (store / city / state)</th><th>Today’s coaching card</th></tr></thead><tbody>{people.slice(0, 100).map((person) => <tr key={person.salespersonId}><td>{person.salesperson}</td><td>{person.storeId}</td><td>{person.bills}</td><td>{[person.peerBills, person.cityPeerBills, person.statePeerBills].map((value) => value?.toFixed(1) ?? "—").join(" / ")}</td><td>{[person.itemsPerBill, person.cityPeerItemsPerBill, person.statePeerItemsPerBill].map((value) => value?.toFixed(2) ?? "—").join(" / ")}</td><td>{coachingCard(person)}</td></tr>)}</tbody></table></div> : <p className="empty-note">No rostered salespeople were found in the latest 28-day period.</p>}<p className="data-footnote">Coaching cards describe a measurable same-store peer gap; they are prompts for a manager to validate, not claims about individual behavior.</p></section>
      : section === "retention" && operating?.available ? <section className="panel module-data"><div className="panel-heading"><div><p className="section-kicker">30+ DAY RETURN DEFINITION</p><h2>Customer retention</h2></div><span className="metric-value">{formatPct(operating.totals.repeatRate)}</span></div><div className="retention-summary"><strong>{operating.totals.returningCustomers.toLocaleString("en-IN")}</strong><span>distinct customers with another bill at least 30 days after their first recorded bill</span></div><p className="data-footnote">Calculated across customers whose first-bill cohort has a complete 30-day observation window. Customer IDs are never displayed.</p></section>
      : section === "stock" && operating?.available ? <section className="panel module-data"><div className="panel-heading"><div><p className="section-kicker">LATEST STOCK SNAPSHOT</p><h2>Stock positions and availability</h2></div><span className="source-note">As of {stock[0]?.asOfDate?.toISOString().slice(0, 10) ?? "—"}</span></div>{stock.length ? <div className="table-scroll"><table><thead><tr><th>Store</th><th>Style</th><th>Category</th><th>On hand</th><th>In transit</th><th>Weeks in stock (avg days)</th><th>Oldest unit age</th></tr></thead><tbody>{stock.slice(0, 100).map((item) => <tr key={`${item.storeId}-${item.skuId}`}><td>{item.storeId}</td><td>{item.styleName} · {item.skuId}</td><td>{item.category}</td><td>{item.onHand}</td><td>{item.inTransit}</td><td>{item.daysInStock?.toFixed(1) ?? "—"}</td><td>{item.oldestDate ? `${Math.max(0, Math.round((item.asOfDate.getTime() - item.oldestDate.getTime()) / 86_400_000))} days` : "—"}</td></tr>)}</tbody></table></div> : <p className="empty-note">No stock snapshot rows are available.</p>}<p className="data-footnote">This view reports source values. Action thresholds depend on validated rules and min_display settings from the workbook.</p></section>
      : section === "recommendations" ? <section className="panel module-data"><div className="panel-heading"><div><p className="section-kicker">VERIFIED METRICS · HUMAN REVIEW</p><h2>Action recommendations</h2></div></div><RecommendationCenter records={recommendationCards} allowRun /></section>
      : section === "weekly-review" ? <section className="panel module-data"><div className="panel-heading"><div><p className="section-kicker">FOLLOW-UP TRACKING</p><h2>Weekly impact review</h2></div></div><RecommendationCenter records={recommendationCards} /></section>
      : <section className="module-empty panel">
        <span className="empty-icon"><Icon name={pageModule.icon} size={21} /></span>
        <p className="section-kicker">DATA REQUIRED</p>
        <h2>This view is ready for validated data.</h2>
        <p>{pageModule.detail}</p>
        <Link className="text-link" href="/data-quality">Review data quality requirements <Icon name="arrow" size={15} /></Link>
      </section>}

      <section className="data-readiness module-readiness">
        <div className="readiness-icon"><Icon name="shield" size={19} /></div>
        <div>
          <p className="section-kicker">{hasData ? "VALIDATED SOURCE DATA" : !databaseReachable ? "DATABASE CONNECTION" : "SOURCE DATA REQUIRED"}</p>
          <h2>{hasData ? "Keep decisions tied to the real source data." : !databaseReachable ? "Connect the deployed database." : "Import the validated source data."}</h2>
          <p>{hasData ? "Metrics on this page are calculated from the imported dataset. The participant brief’s examples are not used as findings." : !databaseReachable ? "Set DATABASE_URL_POOLED for Vercel function traffic and confirm it points to the Neon branch containing the imported dataset." : "The database is online, but no bill data is present yet. Import the supplied CSV bundle before expecting dashboard metrics."}</p>
        </div>
        <span className="readiness-tag">{hasData ? "DATA VERIFIED" : !databaseReachable ? "DATABASE OFFLINE" : "DATA REQUIRED"}</span>
      </section>
    </div>
  );
}

function formatPct(value: number | null) { return value === null ? "—" : `${(value * 100).toFixed(1)}%`; }
function formatMoney(value: number) { return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value); }
function coachingCard(person: { salesperson: string; salespersonId: string; bills: number; peerBills: number | null; itemsPerBill: number | null; peerItemsPerBill: number | null; peerName: string | null }) {
  const peer = person.peerName ?? "a same-store peer";
  if ((person.peerItemsPerBill ?? 0) > (person.itemsPerBill ?? 0)) return `Pair with ${peer} for three customer interactions today. Observe how they offer relevant complementary items, then use one suitable pairing in your next fitting-room conversation.`;
  if ((person.peerBills ?? 0) > person.bills) return `Pair with ${peer} for three customer interactions today. Observe their opening questions and how they guide a visit toward a fitting; practise one approach on your next customer.`;
  return `${person.salesperson}, keep sharing one useful same-store selling behavior with peers today. Your latest-period bills and items per bill are at or above the current store averages.`;
}
