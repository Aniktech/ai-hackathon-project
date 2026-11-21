import { getPrismaClient } from "@/lib/prisma";
import { getOverview, getSalespeople } from "@/lib/analytics";

function startOfWeek(input: Date) {
  const day = input.getUTCDay();
  const date = new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate() - ((day + 6) % 7)));
  return date;
}

export async function runDailyAnalysis() {
  const prisma = getPrismaClient();
  const now = new Date();
  const runDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekStart = startOfWeek(runDate);
  const overview = await getOverview();
  if (!overview.available) return { generated: 0, skipped: "No validated dataset is imported." };

  const stores = await prisma.store.findMany({ select: { storeId: true, areaManagerId: true, areaManager: { select: { maxAlertsPerWeek: true } } } });
  const storeMap = new Map(stores.map((store) => [store.storeId, store]));
  const managerRows = await prisma.recommendation.findMany({
    where: { ownerType: "store", runDate: { gte: weekStart } },
    select: { areaManagerId: true },
    distinct: ["areaManagerId"],
  });
  const managersWithWeeklyRun = new Set(managerRows.map((row) => row.areaManagerId));
  const counts: Record<string, number> = { store: 0, salesperson: 0 };

  const byManager = new Map<string, typeof overview.stores>();
  for (const metric of overview.stores) {
    const store = storeMap.get(metric.storeId);
    if (!store || metric.conversionOpportunity <= 0 || !metric.conversion || !metric.peerConversion || metric.peerConversion <= metric.conversion) continue;
    const entries = byManager.get(store.areaManagerId) ?? [];
    byManager.set(store.areaManagerId, [...entries, metric]);
  }

  for (const [managerId, metrics] of byManager) {
    if (managersWithWeeklyRun.has(managerId)) continue;
    const managerStore = metrics[0] ? storeMap.get(metrics[0].storeId) : undefined;
    const limit = managerStore?.areaManager.maxAlertsPerWeek ?? 5;
    for (const metric of metrics.slice(0, limit)) {
      const store = storeMap.get(metric.storeId)!;
      await prisma.recommendation.upsert({
        where: { runDate_ownerType_ownerId_lever: { runDate, ownerType: "store", ownerId: metric.storeId, lever: "conversion" } },
        create: {
          runDate, ownerType: "store", ownerId: metric.storeId, areaManagerId: store.areaManagerId, storeId: metric.storeId,
          lever: "conversion", cause: "Conversion is below the city and tier peer average. The underlying driver has not yet been established.",
          opportunity: metric.conversionOpportunity, baselineValue: metric.conversion ?? 0,
          action: `Review the latest 28 days of footfall and roster at ${metric.storeId}. Check coverage on the highest-traffic days and compare the result with other stores in ${metric.city} before changing the schedule.`,
        },
        update: {},
      });
      counts.store += 1;
    }
  }

  const people = await getSalespeople();
  for (const person of people) {
    const billGap = (person.peerBills ?? person.bills) - person.bills;
    const itemGap = (person.peerItemsPerBill ?? person.itemsPerBill ?? 0) - (person.itemsPerBill ?? 0);
    if (billGap <= 0 && itemGap <= 0) continue;
    const store = storeMap.get(person.storeId);
    if (!store) continue;
    const lever = itemGap > 0 ? "basket" : "bills";
    const peer = person.peerName ?? "a teammate";
    const action = itemGap > 0
      ? `Pair with ${peer} for three customer interactions today. Observe how they offer relevant complementary items, then try one suitable pairing in your next fitting-room conversation.`
      : `Pair with ${peer} for three customer interactions today. Observe their opening questions and how they guide a visit toward a fitting; practise one approach with your next customer.`;
    await prisma.recommendation.upsert({
      where: { runDate_ownerType_ownerId_lever: { runDate, ownerType: "salesperson", ownerId: person.salespersonId, lever } },
      create: {
        runDate, ownerType: "salesperson", ownerId: person.salespersonId, areaManagerId: store.areaManagerId, storeId: person.storeId,
        lever, cause: "A same-store peer gap is visible in the latest 28 days. Direct observation is needed to identify the behavior behind it.",
        opportunity: 0, baselineValue: lever === "basket" ? person.itemsPerBill ?? 0 : person.bills,
        action,
      },
      update: {},
    });
    counts.salesperson += 1;
  }

  return { generated: counts.store + counts.salesperson, counts, asOf: overview.latestDate, runDate: runDate.toISOString().slice(0, 10) };
}

export async function getRecommendationHistory() {
  const prisma = getPrismaClient();
  return prisma.recommendation.findMany({
    orderBy: [{ runDate: "desc" }, { opportunity: "desc" }],
    take: 1200,
    include: { store: { select: { city: true } }, areaManager: { select: { name: true } } },
  });
}
