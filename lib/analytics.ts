import { getPrismaClient } from "@/lib/prisma";

export type StoreMetric = {
  storeId: string;
  city: string;
  state: string;
  tier: string;
  areaManager: string;
  bills: number;
  customers: number;
  revenue: number;
  footfall: number;
  conversion: number | null;
  itemsPerBill: number | null;
  averageBill: number | null;
  peerConversion: number | null;
  conversionOpportunity: number;
};

export type SalespersonMetric = {
  salespersonId: string;
  salesperson: string;
  storeId: string;
  city: string;
  state: string;
  bills: number;
  itemsPerBill: number | null;
  peerBills: number | null;
  peerItemsPerBill: number | null;
  cityPeerBills: number | null;
  cityPeerItemsPerBill: number | null;
  statePeerBills: number | null;
  statePeerItemsPerBill: number | null;
  peerName: string | null;
};

export type MonthlyMetric = { month: string; revenue: number; bills: number; footfall: number; conversion: number | null };

export type StoreTrendInsight = {
  storeId: string;
  city: string;
  tier: string;
  currentBills: number;
  previousBills: number;
  currentFootfall: number;
  previousFootfall: number;
  currentConversion: number | null;
  previousConversion: number | null;
  peerCurrentConversion: number | null;
  peerPreviousConversion: number | null;
  classification: string;
};

export async function getStoreTrendInsights(): Promise<StoreTrendInsight[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw<Array<Omit<StoreTrendInsight, "classification">>>`
    WITH bounds AS (SELECT MAX(bill_date)::date AS latest_date FROM bills),
    periods AS (
      SELECT latest_date-27 AS current_start, latest_date AS current_end,
        latest_date-55 AS previous_start, latest_date-28 AS previous_end FROM bounds
    ), b AS (
      SELECT store_id,
        COUNT(*) FILTER (WHERE bill_date BETWEEN p.current_start AND p.current_end)::int AS current_bills,
        COUNT(*) FILTER (WHERE bill_date BETWEEN p.previous_start AND p.previous_end)::int AS previous_bills
      FROM bills CROSS JOIN periods p GROUP BY store_id
    ), f AS (
      SELECT store_id,
        SUM(footfall) FILTER (WHERE date BETWEEN p.current_start AND p.current_end)::float8 AS current_footfall,
        SUM(footfall) FILTER (WHERE date BETWEEN p.previous_start AND p.previous_end)::float8 AS previous_footfall
      FROM footfall_daily CROSS JOIN periods p GROUP BY store_id
    ), base AS (
      SELECT st.store_id AS "storeId", st.city, st.tier,
        COALESCE(b.current_bills,0)::int AS "currentBills", COALESCE(b.previous_bills,0)::int AS "previousBills",
        COALESCE(f.current_footfall,0)::float8 AS "currentFootfall", COALESCE(f.previous_footfall,0)::float8 AS "previousFootfall",
        CASE WHEN COALESCE(f.current_footfall,0)>0 THEN b.current_bills::float8/f.current_footfall ELSE NULL END AS "currentConversion",
        CASE WHEN COALESCE(f.previous_footfall,0)>0 THEN b.previous_bills::float8/f.previous_footfall ELSE NULL END AS "previousConversion"
      FROM stores st LEFT JOIN b ON b.store_id=st.store_id LEFT JOIN f ON f.store_id=st.store_id
    ), peers AS (
      SELECT city,tier,AVG("currentConversion") AS current_conversion,AVG("previousConversion") AS previous_conversion
      FROM base GROUP BY city,tier
    )
    SELECT base.*, peers.current_conversion::float8 AS "peerCurrentConversion",
      peers.previous_conversion::float8 AS "peerPreviousConversion"
    FROM base LEFT JOIN peers USING(city,tier)
  `;
  return rows.map((row) => {
    const billsChange = row.previousBills > 0 ? (row.currentBills - row.previousBills) / row.previousBills : null;
    const footfallChange = row.previousFootfall > 0 ? (row.currentFootfall - row.previousFootfall) / row.previousFootfall : null;
    const peerChange = row.peerPreviousConversion && row.peerCurrentConversion !== null
      ? (row.peerCurrentConversion - row.peerPreviousConversion) / row.peerPreviousConversion
      : null;
    const conversionChange = row.previousConversion && row.currentConversion !== null
      ? (row.currentConversion - row.previousConversion) / row.previousConversion
      : null;
    const classification = peerChange !== null && peerChange <= -0.1
      ? "Market-wide slowdown across city and tier peers"
      : billsChange !== null && billsChange <= -0.1 && footfallChange !== null && Math.abs(footfallChange) <= 0.05
        ? "Bills down while footfall is stable"
        : conversionChange !== null && conversionChange <= -0.1 && (peerChange === null || peerChange > -0.1)
          ? "Store-specific conversion decline"
          : "No material 28-day decline detected";
    return { ...row, classification };
  });
}

export type StaffingInsight = {
  storeId: string;
  city: string;
  peakDayAvgFootfall: number;
  peakDayAvgPresentStaff: number;
  peakVisitorLoadPerStaff: number | null;
  typicalVisitorLoadPerStaff: number | null;
  peakDaysWithoutPresentStaff: number;
};

export async function getStaffingInsights(): Promise<StaffingInsight[]> {
  const prisma = getPrismaClient();
  return prisma.$queryRaw<StaffingInsight[]>`
    WITH bounds AS (SELECT MAX(bill_date)::date AS latest_date FROM bills),
    daily AS (
      SELECT f.store_id, f.date, f.footfall::float8 AS footfall,
        COUNT(r.salesperson_id) FILTER (WHERE r.status='Present')::int AS present_staff
      FROM footfall_daily f
      LEFT JOIN roster_daily r ON r.store_id=f.store_id AND r.date=f.date
      CROSS JOIN bounds b
      WHERE f.date BETWEEN b.latest_date-27 AND b.latest_date
      GROUP BY f.store_id, f.date, f.footfall
    ), ranked AS (
      SELECT daily.*, CUME_DIST() OVER (PARTITION BY store_id ORDER BY footfall) AS traffic_rank
      FROM daily
    ), summary AS (
      SELECT store_id,
        AVG(footfall) FILTER (WHERE traffic_rank>=0.75)::float8 AS peak_footfall,
        AVG(present_staff) FILTER (WHERE traffic_rank>=0.75)::float8 AS peak_staff,
        AVG(footfall/NULLIF(present_staff,0)) FILTER (WHERE traffic_rank>=0.75)::float8 AS peak_load,
        AVG(footfall/NULLIF(present_staff,0)) FILTER (WHERE traffic_rank<0.75)::float8 AS typical_load,
        COUNT(*) FILTER (WHERE traffic_rank>=0.75 AND present_staff=0)::int AS peak_unstaffed
      FROM ranked GROUP BY store_id
    )
    SELECT s.store_id AS "storeId", st.city,
      COALESCE(s.peak_footfall,0)::float8 AS "peakDayAvgFootfall",
      COALESCE(s.peak_staff,0)::float8 AS "peakDayAvgPresentStaff",
      s.peak_load::float8 AS "peakVisitorLoadPerStaff",
      s.typical_load::float8 AS "typicalVisitorLoadPerStaff",
      COALESCE(s.peak_unstaffed,0)::int AS "peakDaysWithoutPresentStaff"
    FROM summary s JOIN stores st ON st.store_id=s.store_id
    WHERE s.peak_footfall IS NOT NULL
    ORDER BY s.peak_unstaffed DESC, s.peak_load DESC NULLS LAST
  `;
}

export async function getOverview() {
  const prisma = getPrismaClient();
  const latest = await prisma.bill.aggregate({ _max: { billDate: true } });
  const endDate = latest._max.billDate;
  if (!endDate) return { available: false, latestDate: null, totals: { bills: 0, revenue: 0, footfall: 0, customers: 0, conversion: null, itemsPerBill: null, repeatRate: null, returningCustomers: 0 }, stores: [] as StoreMetric[] };
  const startDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate() - 27));
  const stores = await prisma.$queryRaw<StoreMetric[]>`
    WITH b AS (
      SELECT store_id, COUNT(*)::int AS bills, COUNT(DISTINCT customer_id)::int AS customers
      FROM bills WHERE bill_date BETWEEN ${startDate} AND ${endDate} GROUP BY store_id
    ), s AS (
      SELECT b.store_id, COALESCE(SUM(bl.qty * bl.selling_price),0)::float8 AS revenue,
        COALESCE(SUM(bl.qty) FILTER (WHERE i.is_packaging = false),0)::float8 AS units,
        COUNT(DISTINCT b.bill_id)::int AS line_bills
      FROM bills b JOIN bill_lines bl ON bl.bill_id=b.bill_id JOIN items i ON i.sku_id=bl.sku_id
      WHERE b.bill_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY b.store_id
    ), f AS (
      SELECT store_id, SUM(footfall)::float8 AS footfall FROM footfall_daily WHERE date BETWEEN ${startDate} AND ${endDate} GROUP BY store_id
    ), base AS (
      SELECT st.store_id AS "storeId", st.city, st.state, st.tier, am.name AS "areaManager",
        COALESCE(b.bills,0)::int AS bills, COALESCE(b.customers,0)::int AS customers,
        COALESCE(s.revenue,0)::float8 AS revenue, COALESCE(f.footfall,0)::float8 AS footfall,
        CASE WHEN COALESCE(f.footfall,0)>0 THEN COALESCE(b.bills,0)::float8/f.footfall ELSE NULL END AS conversion,
        CASE WHEN COALESCE(b.bills,0)>0 THEN s.units/b.bills ELSE NULL END AS "itemsPerBill",
        CASE WHEN COALESCE(b.bills,0)>0 THEN s.revenue/b.bills ELSE NULL END AS "averageBill"
      FROM stores st JOIN area_managers am ON am.area_manager_id=st.area_manager_id
      LEFT JOIN b ON b.store_id=st.store_id LEFT JOIN s ON s.store_id=st.store_id LEFT JOIN f ON f.store_id=st.store_id
    ), peers AS (
      SELECT city,tier,SUM(conversion) AS conversion_sum,COUNT(*)::int AS peer_count FROM base WHERE conversion IS NOT NULL GROUP BY city,tier
    )
    SELECT base.*,
      CASE WHEN peers.peer_count>1 THEN ((peers.conversion_sum-base.conversion)/(peers.peer_count-1))::float8 ELSE NULL END AS "peerConversion",
      GREATEST(0,COALESCE((peers.conversion_sum-base.conversion)/NULLIF(peers.peer_count-1,0),0)-COALESCE(base.conversion,0))*base.footfall*COALESCE(base."averageBill",0)::float8 AS "conversionOpportunity"
    FROM base LEFT JOIN peers USING (city,tier) ORDER BY "conversionOpportunity" DESC
  `;

  const [totals, repeat] = await Promise.all([
    prisma.$queryRaw<Array<{ bills: number; revenue: number; footfall: number; customers: number; items: number }>>`
      SELECT (SELECT COUNT(*)::int FROM bills WHERE bill_date BETWEEN ${startDate} AND ${endDate}) AS bills,
        (SELECT COALESCE(SUM(bl.qty*bl.selling_price),0)::float8 FROM bill_lines bl JOIN bills b ON b.bill_id=bl.bill_id WHERE b.bill_date BETWEEN ${startDate} AND ${endDate}) AS revenue,
        (SELECT COALESCE(SUM(footfall),0)::float8 FROM footfall_daily WHERE date BETWEEN ${startDate} AND ${endDate}) AS footfall,
        (SELECT COUNT(DISTINCT customer_id)::int FROM bills WHERE bill_date BETWEEN ${startDate} AND ${endDate}) AS customers,
        (SELECT COALESCE(SUM(bl.qty),0)::float8 FROM bill_lines bl JOIN bills b ON b.bill_id=bl.bill_id JOIN items i ON i.sku_id=bl.sku_id WHERE i.is_packaging=false AND b.bill_date BETWEEN ${startDate} AND ${endDate}) AS items
    `,
    prisma.$queryRaw<Array<{ returning: number; total: number }>>`
      WITH bounds AS (SELECT MAX(bill_date)::date AS latest_date FROM bills),
      first_bill AS (SELECT customer_id, MIN(bill_date)::date AS first_date FROM bills GROUP BY customer_id),
      eligible AS (SELECT f.* FROM first_bill f CROSS JOIN bounds b WHERE f.first_date<=b.latest_date-30),
      returned AS (SELECT DISTINCT f.customer_id FROM eligible f JOIN bills b ON b.customer_id=f.customer_id AND b.bill_date>=f.first_date+30)
      SELECT (SELECT COUNT(*)::int FROM returned) AS returning,
        (SELECT COUNT(*)::int FROM eligible) AS total
    `,
  ]);

  const summary = totals[0];
  return {
    available: Boolean(summary?.bills),
    latestDate: endDate.toISOString().slice(0, 10),
    totals: {
      bills: summary?.bills ?? 0,
      revenue: summary?.revenue ?? 0,
      footfall: summary?.footfall ?? 0,
      customers: summary?.customers ?? 0,
      conversion: summary?.footfall ? summary.bills / summary.footfall : null,
      itemsPerBill: summary?.bills ? summary.items / summary.bills : null,
      repeatRate: repeat[0]?.total ? repeat[0].returning / repeat[0].total : null,
      returningCustomers: repeat[0]?.returning ?? 0,
    },
    stores,
  };
}

export function explainIssue(input: { storeId: string; lever: string; amount: number; gap: number }) {
  const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(input.amount);
  return `${input.storeId} is below its city and tier peer group on ${input.lever}. The estimated opportunity is ${rupees}; the observed gap is ${(input.gap * 100).toFixed(1)} percentage points. Review the recent shift roster and confirm floor coverage before changing the action plan.`;
}

export async function getSalespeople() {
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw<SalespersonMetric[]>`
    WITH bounds AS (SELECT MAX(bill_date)::date AS end_date FROM bills),
    sales AS (
      SELECT sp.salesperson_id AS "salespersonId", sp.name AS salesperson, sp.store_id AS "storeId", st.city, st.state,
        COUNT(DISTINCT b.bill_id)::int AS bills,
        CASE WHEN COUNT(DISTINCT b.bill_id)>0 THEN SUM(bl.qty) FILTER (WHERE i.is_packaging=false)::float8/COUNT(DISTINCT b.bill_id) ELSE NULL END AS "itemsPerBill"
      FROM salespeople sp JOIN stores st ON st.store_id=sp.store_id CROSS JOIN bounds x
      LEFT JOIN bills b ON b.salesperson_id=sp.salesperson_id AND b.bill_date BETWEEN x.end_date-27 AND x.end_date
      LEFT JOIN bill_lines bl ON bl.bill_id=b.bill_id LEFT JOIN items i ON i.sku_id=bl.sku_id
      WHERE EXISTS (SELECT 1 FROM roster_daily rd WHERE rd.salesperson_id=sp.salesperson_id AND rd.store_id=sp.store_id AND rd.status='Present' AND rd.date BETWEEN x.end_date-27 AND x.end_date)
      GROUP BY sp.salesperson_id, sp.name, sp.store_id, st.city, st.state
    ), peers AS (
      SELECT a.*,
        (SELECT AVG(q.bills)::float8 FROM sales q WHERE q."storeId"=a."storeId" AND q."salespersonId"<>a."salespersonId") AS "peerBills",
        (SELECT AVG(q."itemsPerBill")::float8 FROM sales q WHERE q."storeId"=a."storeId" AND q."salespersonId"<>a."salespersonId") AS "peerItemsPerBill",
        (SELECT AVG(q.bills)::float8 FROM sales q WHERE q.city=a.city AND q."salespersonId"<>a."salespersonId") AS "cityPeerBills",
        (SELECT AVG(q."itemsPerBill")::float8 FROM sales q WHERE q.city=a.city AND q."salespersonId"<>a."salespersonId") AS "cityPeerItemsPerBill",
        (SELECT AVG(q.bills)::float8 FROM sales q WHERE q.state=a.state AND q."salespersonId"<>a."salespersonId") AS "statePeerBills",
        (SELECT AVG(q."itemsPerBill")::float8 FROM sales q WHERE q.state=a.state AND q."salespersonId"<>a."salespersonId") AS "statePeerItemsPerBill"
      FROM sales a
    )
    SELECT p."salespersonId", p.salesperson, p."storeId", p.city, p.state, p.bills, p."itemsPerBill", p."peerBills", p."peerItemsPerBill", p."cityPeerBills", p."cityPeerItemsPerBill", p."statePeerBills", p."statePeerItemsPerBill",
      (SELECT q.salesperson FROM sales q WHERE q."storeId"=p."storeId" AND q."salespersonId"<>p."salespersonId" ORDER BY ABS(q.bills-p."peerBills"), q.salesperson LIMIT 1) AS "peerName"
    FROM peers p ORDER BY (COALESCE(p."peerBills",0)-p.bills) DESC, (COALESCE(p."peerItemsPerBill",0)-COALESCE(p."itemsPerBill",0)) DESC
  `;
  return rows;
}

export async function getStockInsights() {
  const prisma = getPrismaClient();
  return prisma.$queryRaw<Array<{ storeId: string; city: string; skuId: string; styleName: string; category: string; onHand: number; inTransit: number; asOfDate: Date; oldestDate: Date | null; daysInStock: number | null; soldUnits: number; soldRevenue: number; daysCover: number | null; availabilitySignal: string }>>`
    WITH latest AS (SELECT MAX(as_of_date)::date AS d FROM stock_snapshot),
    sales_bounds AS (SELECT MAX(bill_date)::date AS d FROM bills),
    sold AS (
      SELECT b.store_id, bl.sku_id, SUM(bl.qty)::int AS units,
        SUM(bl.qty*bl.selling_price)::float8 AS revenue
      FROM bills b JOIN bill_lines bl ON bl.bill_id=b.bill_id JOIN items i ON i.sku_id=bl.sku_id
      CROSS JOIN sales_bounds x
      WHERE b.bill_date BETWEEN x.d-27 AND x.d AND i.is_packaging=false
      GROUP BY b.store_id, bl.sku_id
    ),
    weekly AS (SELECT store_id, sku_id, AVG(days_in_stock)::float8 AS days FROM stock_weekly GROUP BY store_id,sku_id)
    SELECT s.location_id AS "storeId", st.city, i.sku_id AS "skuId", i.style_name AS "styleName", i.category,
      s.on_hand AS "onHand", s.in_transit AS "inTransit", s.as_of_date AS "asOfDate", s.oldest_stock_received_on AS "oldestDate", w.days AS "daysInStock",
      COALESCE(sold.units,0)::int AS "soldUnits", COALESCE(sold.revenue,0)::float8 AS "soldRevenue",
      CASE WHEN COALESCE(sold.units,0)>0 THEN s.on_hand*28.0/sold.units ELSE NULL END::float8 AS "daysCover",
      CASE WHEN COALESCE(sold.units,0)>0 AND s.on_hand=0 AND s.in_transit=0 THEN 'Recent sales with no on-hand or incoming units'
        WHEN COALESCE(sold.units,0)>0 AND s.on_hand*28.0/sold.units<7 THEN 'Under seven days of recent sales cover'
        ELSE 'No immediate sales-cover signal' END AS "availabilitySignal"
    FROM stock_snapshot s JOIN latest l ON s.as_of_date=l.d JOIN stores st ON st.store_id=s.location_id
    JOIN items i ON i.sku_id=s.sku_id LEFT JOIN weekly w ON w.store_id=s.location_id AND w.sku_id=s.sku_id
    LEFT JOIN sold ON sold.store_id=s.location_id AND sold.sku_id=s.sku_id
    ORDER BY CASE WHEN COALESCE(sold.units,0)>0 AND s.on_hand=0 AND s.in_transit=0 THEN 0
      WHEN COALESCE(sold.units,0)>0 AND s.on_hand*28.0/sold.units<7 THEN 1 ELSE 2 END, w.days ASC NULLS LAST, s.on_hand DESC LIMIT 250
  `;
}

export type PairingInsight = {
  storeId: string;
  city: string;
  tier: string;
  anchorCategory: string;
  complementCategory: string;
  anchorBills: number;
  attachedBills: number;
  attachRate: number;
  peerAttachRate: number | null;
  opportunity: number;
};

export async function getCategoryPairingInsights(): Promise<PairingInsight[]> {
  const prisma = getPrismaClient();
  return prisma.$queryRaw<PairingInsight[]>`
    WITH bounds AS (SELECT MAX(bill_date)::date AS latest_date FROM bills),
    category_bills AS (
      SELECT b.store_id, b.bill_id, i.category, SUM(bl.qty * bl.selling_price)::float8 AS revenue
      FROM bills b
      JOIN bill_lines bl ON bl.bill_id=b.bill_id
      JOIN items i ON i.sku_id=bl.sku_id
      CROSS JOIN bounds x
      WHERE b.bill_date BETWEEN x.latest_date-27 AND x.latest_date AND i.is_packaging=false
      GROUP BY b.store_id, b.bill_id, i.category
    ), pair_definitions AS (
      SELECT * FROM (VALUES
        ('Sherwani','Mojari'), ('Sherwani','Safa'), ('Sherwani','Mala'), ('Sherwani','Stole'),
        ('Kurta Set','Mojari'), ('Kurta Set','Stole'), ('Indo-Western','Mojari'), ('Indo-Western','Safa')
      ) AS pair(anchor_category, complement_category)
    ), pair_metrics AS (
      SELECT st.store_id AS "storeId", st.city, st.tier, d.anchor_category AS "anchorCategory",
        d.complement_category AS "complementCategory",
        COUNT(DISTINCT a.bill_id)::int AS "anchorBills",
        COUNT(DISTINCT c.bill_id)::int AS "attachedBills",
        CASE WHEN COUNT(DISTINCT c.bill_id)>0 THEN AVG(c.revenue)::float8 ELSE 0::float8 END AS "averageComplementRevenue"
      FROM stores st CROSS JOIN pair_definitions d
      LEFT JOIN category_bills a ON a.store_id=st.store_id AND a.category=d.anchor_category
      LEFT JOIN category_bills c ON c.store_id=a.store_id AND c.bill_id=a.bill_id AND c.category=d.complement_category
      GROUP BY st.store_id, st.city, st.tier, d.anchor_category, d.complement_category
    ), rates AS (
      SELECT *, CASE WHEN "anchorBills">0 THEN "attachedBills"::float8/"anchorBills" ELSE NULL END AS attach_rate
      FROM pair_metrics
    )
    SELECT r."storeId", r.city, r.tier, r."anchorCategory", r."complementCategory", r."anchorBills", r."attachedBills",
      r.attach_rate::float8 AS "attachRate",
      peers.peer_attach_rate::float8 AS "peerAttachRate",
      GREATEST(0,COALESCE(peers.peer_attach_rate-r.attach_rate,0)*r."anchorBills"*r."averageComplementRevenue")::float8 AS opportunity
    FROM rates r
    LEFT JOIN LATERAL (
      SELECT AVG(other.attach_rate) AS peer_attach_rate
      FROM rates other
      WHERE other."storeId"<>r."storeId" AND other.city=r.city AND other.tier=r.tier
        AND other."anchorCategory"=r."anchorCategory" AND other."complementCategory"=r."complementCategory"
    ) peers ON TRUE
    WHERE r."anchorBills">=5 AND peers.peer_attach_rate IS NOT NULL AND peers.peer_attach_rate>r.attach_rate
    ORDER BY opportunity DESC
    LIMIT 100
  `;
}

export async function getMonthlyTrend(): Promise<MonthlyMetric[]> {
  const prisma = getPrismaClient();
  return prisma.$queryRaw<MonthlyMetric[]>`
    WITH bounds AS (SELECT MAX(bill_date)::date AS latest_date FROM bills),
    months AS (
      SELECT generate_series(date_trunc('month', latest_date::timestamp)-interval '11 months', date_trunc('month', latest_date::timestamp), interval '1 month')::date AS month
      FROM bounds WHERE latest_date IS NOT NULL
    ), b AS (
      SELECT date_trunc('month', bills.bill_date::timestamp)::date AS month,
        COUNT(DISTINCT bills.bill_id)::int AS bills,
        SUM(bl.qty*bl.selling_price)::float8 AS revenue
      FROM bills LEFT JOIN bill_lines bl ON bl.bill_id=bills.bill_id GROUP BY 1
    ), f AS (
      SELECT date_trunc('month', date::timestamp)::date AS month, SUM(footfall)::float8 AS footfall
      FROM footfall_daily GROUP BY 1
    )
    SELECT to_char(m.month,'Mon YY') AS month, COALESCE(b.revenue,0)::float8 AS revenue,
      COALESCE(b.bills,0)::int AS bills, COALESCE(f.footfall,0)::float8 AS footfall,
      CASE WHEN COALESCE(f.footfall,0)>0 THEN b.bills::float8/f.footfall ELSE NULL END AS conversion
    FROM months m LEFT JOIN b USING(month) LEFT JOIN f USING(month) ORDER BY m.month
  `;
}

export type RetentionCohortInsight = {
  storeId: string;
  city: string;
  state: string;
  weddingSeasonCustomers: number;
  lapsedCustomers: number;
  lapsedRate: number | null;
};

export async function getLapsedWeddingCohorts(): Promise<RetentionCohortInsight[]> {
  const prisma = getPrismaClient();
  return prisma.$queryRaw<RetentionCohortInsight[]>`
    WITH bounds AS (SELECT MAX(bill_date)::date AS latest_date FROM bills),
    wedding_buyers AS (
      SELECT DISTINCT ON (b.customer_id) b.customer_id, b.store_id, st.city, st.state
      FROM bills b
      JOIN stores st ON st.store_id=b.store_id
      JOIN calendar c ON c.date=b.bill_date AND c.state=st.state AND c.is_wedding_date=true
      CROSS JOIN bounds x
      WHERE b.bill_date BETWEEN x.latest_date-365 AND x.latest_date-30
      ORDER BY b.customer_id, b.bill_date DESC, b.store_id
    ), last_seen AS (
      SELECT customer_id, MAX(bill_date)::date AS last_bill_date FROM bills GROUP BY customer_id
    ), cohorts AS (
      SELECT w.store_id, w.city, w.state, w.customer_id,
        CASE WHEN l.last_bill_date<=x.latest_date-30 THEN true ELSE false END AS is_lapsed
      FROM wedding_buyers w
      JOIN last_seen l ON l.customer_id=w.customer_id
      CROSS JOIN bounds x
    )
    SELECT store_id AS "storeId", city, state,
      COUNT(*)::int AS "weddingSeasonCustomers",
      COUNT(*) FILTER (WHERE is_lapsed)::int AS "lapsedCustomers",
      CASE WHEN COUNT(*)>0 THEN (COUNT(*) FILTER (WHERE is_lapsed))::float8/COUNT(*) ELSE NULL END AS "lapsedRate"
    FROM cohorts
    GROUP BY store_id, city, state
    ORDER BY "lapsedCustomers" DESC, store_id
  `;
}
