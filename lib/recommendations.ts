import { getPrismaClient } from "@/lib/prisma";
import { getCategoryPairingInsights, getOverview, getSalespeople, getStaffingInsights, getStoreTrendInsights, type PairingInsight } from "@/lib/analytics";

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
  const [trendRows, staffingRows, pairings] = await Promise.all([
    getStoreTrendInsights().catch(() => []),
    getStaffingInsights().catch(() => []),
    getCategoryPairingInsights().catch(() => []),
  ]);
  const trendByStore = new Map(trendRows.map((row) => [row.storeId, row]));
  const staffingByStore = new Map(staffingRows.map((row) => [row.storeId, row]));
  const managerRows = await prisma.recommendation.findMany({
    where: { ownerType: "store", runDate: { gte: weekStart } },
    select: { areaManagerId: true },
    distinct: ["areaManagerId"],
  });
  const managersWithWeeklyRun = new Set(managerRows.map((row) => row.areaManagerId));
  const counts: Record<string, number> = { store: 0, salesperson: 0 };

  type ManagerIssue = { storeId: string; lever: "conversion" | "pairing"; opportunity: number; baseline: number; cause: string; action: string };
  const byManager = new Map<string, ManagerIssue[]>();
  const addIssue = (managerId: string, issue: ManagerIssue) => byManager.set(managerId, [...(byManager.get(managerId) ?? []), issue]);
  for (const metric of overview.stores) {
    const store = storeMap.get(metric.storeId);
    if (!store || metric.conversionOpportunity <= 0 || !metric.conversion || !metric.peerConversion || metric.peerConversion <= metric.conversion) continue;
    const trend = trendByStore.get(metric.storeId);
    const staffing = staffingByStore.get(metric.storeId);
    const coverageSignal = staffing?.peakVisitorLoadPerStaff && staffing.typicalVisitorLoadPerStaff
      ? ` Peak days average ${staffing.peakVisitorLoadPerStaff.toFixed(1)} visitors per present salesperson versus ${staffing.typicalVisitorLoadPerStaff.toFixed(1)} on other days.`
      : " Peak-day staffing data is unavailable.";
    addIssue(store.areaManagerId, {
      storeId: metric.storeId, lever: "conversion", opportunity: metric.conversionOpportunity, baseline: metric.conversion,
      cause: `Conversion is below the relevant city and tier peer average. Trend signal: ${trend?.classification ?? "28-day trend unavailable"}.${coverageSignal} These are observed signals, not proof of cause.`,
      action: trend?.classification === "Market-wide slowdown across city and tier peers"
        ? `Peer stores in ${metric.city} are also slowing. Review market context alongside ${metric.storeId}’s roster before treating this as a store-only issue.`
        : `Review footfall and roster together for ${metric.storeId}. Check floor coverage on high-traffic periods and compare shifts with nearby peers before changing the schedule.`,
    });
  }

  const bestPairingByStore = new Map<string, PairingInsight>();
  for (const pairing of pairings) {
    const current = bestPairingByStore.get(pairing.storeId);
    if (!current || pairing.opportunity > current.opportunity) bestPairingByStore.set(pairing.storeId, pairing);
  }
  for (const pairing of bestPairingByStore.values()) {
    const store = storeMap.get(pairing.storeId);
    if (!store || pairing.opportunity <= 0 || pairing.peerAttachRate === null) continue;
    addIssue(store.areaManagerId, {
      storeId: pairing.storeId, lever: "pairing", opportunity: pairing.opportunity, baseline: pairing.attachRate,
      cause: `${pairing.anchorCategory} bills include ${pairing.complementCategory} in ${(pairing.attachRate * 100).toFixed(1)}% of eligible purchases, below the ${pairing.city} ${pairing.tier} peer rate of ${(pairing.peerAttachRate * 100).toFixed(1)}%.`,
      action: `Review the ${pairing.anchorCategory} and ${pairing.complementCategory} pairing with the team at ${pairing.storeId}. Practise one relevant outfit suggestion and track its attach rate next week.`,
    });
  }

  for (const [managerId, issues] of byManager) {
    if (managersWithWeeklyRun.has(managerId)) continue;
    const managerStore = issues[0] ? storeMap.get(issues[0].storeId) : undefined;
    const limit = managerStore?.areaManager.maxAlertsPerWeek ?? 5;
    for (const issue of issues.sort((a, b) => b.opportunity - a.opportunity).slice(0, limit)) {
      const store = storeMap.get(issue.storeId)!;
      await prisma.recommendation.upsert({
        where: { runDate_ownerType_ownerId_lever: { runDate, ownerType: "store", ownerId: issue.storeId, lever: issue.lever } },
        create: {
          runDate, ownerType: "store", ownerId: issue.storeId, areaManagerId: store.areaManagerId, storeId: issue.storeId,
          lever: issue.lever, cause: issue.cause, opportunity: issue.opportunity, baselineValue: issue.baseline, action: issue.action,
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
