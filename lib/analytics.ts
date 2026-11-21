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
      SELECT city,tier,AVG(conversion) AS peer_conversion FROM base WHERE conversion IS NOT NULL GROUP BY city,tier
    )
    SELECT base.*, peers.peer_conversion::float8 AS "peerConversion",
      GREATEST(0,COALESCE(peers.peer_conversion-base.conversion,0)*base.footfall*COALESCE(base."averageBill",0))::float8 AS "conversionOpportunity"
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
      SELECT a.*, AVG(bills) OVER (PARTITION BY "storeId")::float8 AS "peerBills",
        AVG("itemsPerBill") OVER (PARTITION BY "storeId")::float8 AS "peerItemsPerBill",
        AVG(bills) OVER (PARTITION BY city)::float8 AS "cityPeerBills",
        AVG("itemsPerBill") OVER (PARTITION BY city)::float8 AS "cityPeerItemsPerBill",
        AVG(bills) OVER (PARTITION BY state)::float8 AS "statePeerBills",
        AVG("itemsPerBill") OVER (PARTITION BY state)::float8 AS "statePeerItemsPerBill"
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
  return prisma.$queryRaw<Array<{ storeId: string; city: string; skuId: string; styleName: string; category: string; onHand: number; inTransit: number; asOfDate: Date; oldestDate: Date | null; daysInStock: number | null }>>`
    WITH latest AS (SELECT MAX(as_of_date)::date AS d FROM stock_snapshot),
    weekly AS (SELECT store_id, sku_id, AVG(days_in_stock)::float8 AS days FROM stock_weekly GROUP BY store_id,sku_id)
    SELECT s.location_id AS "storeId", st.city, i.sku_id AS "skuId", i.style_name AS "styleName", i.category,
      s.on_hand AS "onHand", s.in_transit AS "inTransit", s.as_of_date AS "asOfDate", s.oldest_stock_received_on AS "oldestDate", w.days AS "daysInStock"
    FROM stock_snapshot s JOIN latest l ON s.as_of_date=l.d JOIN stores st ON st.store_id=s.location_id
    JOIN items i ON i.sku_id=s.sku_id LEFT JOIN weekly w ON w.store_id=s.location_id AND w.sku_id=s.sku_id
    ORDER BY w.days ASC NULLS LAST, s.on_hand DESC LIMIT 250
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
