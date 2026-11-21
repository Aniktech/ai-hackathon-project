import Link from "next/link";
import { notFound } from "next/navigation";
import { moduleBySlug, modules } from "@/lib/navigation";
import { Icon } from "@/components/icon";
import { ImportPanel } from "@/components/import-panel";
import { getOverview } from "@/lib/analytics";
import { getCategoryPairingInsights, getLapsedWeddingCohorts, getSalespeople, getStaffingInsights, getStockInsights, getStoreTrendInsights } from "@/lib/analytics";
import { getRecommendationHistory } from "@/lib/recommendations";
import { RecommendationCenter, type RecommendationCard } from "@/components/recommendation-center";
import { SalespersonCoach } from "@/components/salesperson-coach";

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
  const pairings = ["stores", "area-managers"].includes(section) ? await getCategoryPairingInsights().catch(() => []) : [];
  const lapsedCohorts = section === "retention" ? await getLapsedWeddingCohorts().catch(() => []) : [];
  const trends = section === "area-managers" ? await getStoreTrendInsights().catch(() => []) : [];
  const staffing = section === "area-managers" ? await getStaffingInsights().catch(() => []) : [];
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
  const managerPriorities = new Map<string, Array<{ storeId: string; city: string; opportunity: number; detail: string }>>();
  const trendByStore = new Map(trends.map((item) => [item.storeId, item]));
  const staffingByStore = new Map(staffing.map((item) => [item.storeId, item]));
  for (const store of operating?.stores ?? []) {
    if (store.conversionOpportunity <= 0) continue;
    const trend = trendByStore.get(store.storeId);
    const staff = staffingByStore.get(store.storeId);
    const current = managerPriorities.get(store.areaManager) ?? [];
    current.push({
      storeId: store.storeId, city: store.city, opportunity: store.conversionOpportunity,
      detail: `Conversion ${formatPct(store.conversion)} vs peer ${formatPct(store.peerConversion)} · ${trend?.classification ?? "Trend unavailable"} · peak visitors per present salesperson: ${staff?.peakVisitorLoadPerStaff?.toFixed(1) ?? "—"} vs typical ${staff?.typicalVisitorLoadPerStaff?.toFixed(1) ?? "—"}.`,
    });
    managerPriorities.set(store.areaManager, current);
  }
  for (const pairing of pairings) {
    const store = operating?.stores.find((metric) => metric.storeId === pairing.storeId);
    if (!store || pairing.opportunity <= 0) continue;
    const current = managerPriorities.get(store.areaManager) ?? [];
    current.push({
      storeId: pairing.storeId, city: pairing.city, opportunity: pairing.opportunity,
      detail: `${pairing.anchorCategory} + ${pairing.complementCategory} attach rate ${formatPct(pairing.attachRate)} vs peer ${formatPct(pairing.peerAttachRate)}.`,
    });
    managerPriorities.set(store.areaManager, current);
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
      </section> : section === "area-managers" && operating?.available ? <section className="panel module-data"><div className="panel-heading"><div><p className="section-kicker">MAXIMUM FIVE PER MANAGER</p><h2>Store and basket priorities ranked by estimated opportunity</h2></div></div>{managerPriorities.size ? [...managerPriorities.entries()].map(([manager, entries]) => <div className="data-group" key={manager}><h3>{manager}</h3>{entries.sort((a, b) => b.opportunity - a.opportunity).slice(0, 5).map((store) => <div className="priority-row" key={`${store.storeId}-${store.detail}`}><span><strong>{store.storeId} · {store.city}</strong><small>{store.detail}</small></span><b>{formatMoney(store.opportunity)}</b></div>)}</div>) : <p className="empty-note">No conversion or complementary-category opportunity was found against relevant peers in the latest 28 days.</p>}</section>
      : section === "stores" && operating?.available ? <section className="panel module-data"><div className="panel-heading"><div><p className="section-kicker">LATEST 28 DAYS · CITY AND TIER PEERS</p><h2>Store performance</h2></div><span className="source-note">Through {operating.latestDate}</span></div><div className="table-scroll"><table><thead><tr><th>Store</th><th>City / tier</th><th>Bills</th><th>Conversion</th><th>Peer</th><th>Items / bill</th><th>Revenue opportunity</th></tr></thead><tbody>{operating.stores.map((store) => <tr key={store.storeId}><td>{store.storeId}</td><td>{store.city} · {store.tier}</td><td>{store.bills.toLocaleString("en-IN")}</td><td>{formatPct(store.conversion)}</td><td>{formatPct(store.peerConversion)}</td><td>{store.itemsPerBill?.toFixed(2) ?? "—"}</td><td>{formatMoney(store.conversionOpportunity)}</td></tr>)}</tbody></table></div></section>
      : section === "salespeople" && operating?.available ? <section className="panel module-data"><div className="panel-heading"><div><p className="section-kicker">LATEST 28 DAYS · STORE, CITY AND STATE PEERS</p><h2>Salesperson performance and coaching</h2></div></div>{people.length ? <div className="table-scroll"><table><thead><tr><th>Salesperson</th><th>Store</th><th>Bills</th><th>Peer avg. bills (store / city / state)</th><th>Items per bill (store / city / state)</th><th>Today’s coaching card</th></tr></thead><tbody>{people.slice(0, 100).map((person) => <tr key={person.salespersonId}><td>{person.salesperson}</td><td>{person.storeId}</td><td>{person.bills}</td><td>{[person.peerBills, person.cityPeerBills, person.statePeerBills].map((value) => value?.toFixed(1) ?? "—").join(" / ")}</td><td>{[person.itemsPerBill, person.cityPeerItemsPerBill, person.statePeerItemsPerBill].map((value) => value?.toFixed(2) ?? "—").join(" / ")}</td><td><SalespersonCoach metrics={{ bills: person.bills, peerBills: person.peerBills, cityPeerBills: person.cityPeerBills, statePeerBills: person.statePeerBills, itemsPerBill: person.itemsPerBill, peerItemsPerBill: person.peerItemsPerBill, cityPeerItemsPerBill: person.cityPeerItemsPerBill, statePeerItemsPerBill: person.statePeerItemsPerBill }} initialText={coachingCard(person)} /></td></tr>)}</tbody></table></div> : <p className="empty-note">No rostered salespeople were found in the latest 28-day period.</p>}<p className="data-footnote">Coaching cards describe a measurable same-store peer gap; they are prompts for a manager to validate, not claims about individual behavior.</p></section>
      : section === "retention" && operating?.available ? <section className="panel module-data"><div className="panel-heading"><div><p className="section-kicker">30+ DAY RETURN DEFINITION</p><h2>Customer retention</h2></div><span className="metric-value">{formatPct(operating.totals.repeatRate)}</span></div><div className="retention-summary"><strong>{operating.totals.returningCustomers.toLocaleString("en-IN")}</strong><span>distinct customers with another bill at least 30 days after their first recorded bill</span></div><p className="data-footnote">Calculated across customers whose first-bill cohort has a complete 30-day observation window. Customer IDs are never displayed.</p></section>
      : section === "stock" && operating?.available ? <section className="panel module-data"><div className="panel-heading"><div><p className="section-kicker">LATEST STOCK SNAPSHOT</p><h2>Stock positions and availability</h2></div><span className="source-note">As of {stock[0]?.asOfDate?.toISOString().slice(0, 10) ?? "—"}</span></div>{stock.length ? <div className="table-scroll"><table><thead><tr><th>Store</th><th>Style</th><th>Category</th><th>On hand</th><th>In transit</th><th>Sold (28d)</th><th>Days of sales cover</th><th>Availability signal</th><th>Avg. days in stock</th><th>Oldest unit age</th></tr></thead><tbody>{stock.slice(0, 100).map((item) => <tr key={`${item.storeId}-${item.skuId}`}><td>{item.storeId}</td><td>{item.styleName} · {item.skuId}</td><td>{item.category}</td><td>{item.onHand}</td><td>{item.inTransit}</td><td>{item.soldUnits}</td><td>{item.daysCover?.toFixed(1) ?? "—"}</td><td>{item.availabilitySignal}</td><td>{item.daysInStock?.toFixed(1) ?? "—"}</td><td>{item.oldestDate ? `${Math.max(0, Math.round((item.asOfDate.getTime() - item.oldestDate.getTime()) / 86_400_000))} days` : "—"}</td></tr>)}</tbody></table></div> : <p className="empty-note">No stock snapshot rows are available.</p>}<p className="data-footnote">This view reports source values. Action thresholds depend on validated rules and min_display settings from the workbook.</p></section>
      : section === "recommendations" ? <section className="panel module-data"><div className="panel-heading"><div><p className="section-kicker">VERIFIED METRICS · HUMAN REVIEW</p><h2>Action recommendations</h2></div></div><RecommendationCenter records={recommendationCards} allowRun /></section>
      : section === "weekly-review" ? <section className="panel module-data"><div className="panel-heading"><div><p className="section-kicker">FOLLOW-UP TRACKING</p><h2>Weekly impact review</h2></div></div><RecommendationCenter records={recommendationCards} /></section>
      : <section className="module-empty panel">
        <span className="empty-icon"><Icon name={pageModule.icon} size={21} /></span>
        <p className="section-kicker">DATA REQUIRED</p>
        <h2>This view is ready for validated data.</h2>
        <p>{pageModule.detail}</p>
        <Link className="text-link" href="/data-quality">Review data quality requirements <Icon name="arrow" size={15} /></Link>
      </section>}

      {section === "stores" && operating?.available && <section className="panel module-data pairing-panel">
        <div className="panel-heading"><div><p className="section-kicker">BASKET ATTACHMENT · LATEST 28 DAYS</p><h2>Complementary category opportunities</h2></div></div>
        {pairings.length ? <div className="table-scroll"><table><thead><tr><th>Store</th><th>City / tier</th><th>Outfit category</th><th>Complement</th><th>Paired bills / eligible</th><th>Attach rate / peer</th><th>Estimated opportunity</th></tr></thead><tbody>{pairings.map((pair) => <tr key={`${pair.storeId}-${pair.anchorCategory}-${pair.complementCategory}`}><td>{pair.storeId}</td><td>{pair.city} · {pair.tier}</td><td>{pair.anchorCategory}</td><td>{pair.complementCategory}</td><td>{pair.attachedBills} / {pair.anchorBills}</td><td>{formatPct(pair.attachRate)} / {formatPct(pair.peerAttachRate)}</td><td>{formatMoney(pair.opportunity)}</td></tr>)}</tbody></table></div> : <p className="empty-note">No statistically useful pairing gaps were found in the latest 28 days; each displayed pairing needs at least five relevant bills and peer data.</p>}
        <p className="data-footnote">The opportunity estimates peer attach-rate improvement using the observed average value of the complementary category. Treat it as a planning estimate, not guaranteed revenue.</p>
      </section>}

      {section === "retention" && operating?.available && <section className="panel module-data retention-cohort-panel">
        <div className="panel-heading"><div><p className="section-kicker">PRIOR WEDDING-DATE BUYERS · AGGREGATE ONLY</p><h2>Customers to consider re-engaging</h2></div></div>
        {lapsedCohorts.length ? <div className="table-scroll"><table><thead><tr><th>Store</th><th>City</th><th>Season buyers (last 12 months)</th><th>No bill in latest 30 days</th><th>Lapsed share</th></tr></thead><tbody>{lapsedCohorts.slice(0, 20).map((cohort) => <tr key={cohort.storeId}><td>{cohort.storeId}</td><td>{cohort.city}</td><td>{cohort.weddingSeasonCustomers.toLocaleString("en-IN")}</td><td>{cohort.lapsedCustomers.toLocaleString("en-IN")}</td><td>{formatPct(cohort.lapsedRate)}</td></tr>)}</tbody></table></div> : <p className="empty-note">No prior wedding-date buyer cohorts met the observation window in this dataset.</p>}
        <p className="data-footnote">This is an aggregate re-engagement signal. It does not expose customer identities or imply that a customer should be contacted without the company’s approved consent process.</p>
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
  const billAverage = person.peerBills ?? person.bills;
  const itemAverage = person.peerItemsPerBill ?? person.itemsPerBill ?? 0;
  const billGap = (billAverage - person.bills) / Math.max(billAverage, 1);
  const itemGap = (itemAverage - (person.itemsPerBill ?? 0)) / Math.max(itemAverage, 0.1);
  if (itemGap > 0 && itemGap >= billGap) return `${person.salesperson}: items per bill are ${(person.itemsPerBill ?? 0).toFixed(2)} versus a same-store average of ${itemAverage.toFixed(2)}. Ask ${peer} to demonstrate one relevant accessory pairing, practise it in three fittings, and review your item attachment rate.`;
  if (billGap > 0) return `${person.salesperson}: ${person.bills} bills versus a same-store average of ${billAverage.toFixed(1)}. Observe ${peer}’s opening question and fitting invitation; practise one approach in three customer interactions and review your next-period bill count.`;
  return `${person.salesperson}: bills and items per bill are at or above the same-store averages. Share one approach that works for you, and keep tracking both measures against city and state peers.`;
}
