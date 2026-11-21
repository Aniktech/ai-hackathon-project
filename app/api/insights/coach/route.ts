import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Metrics = {
  bills: number;
  peerBills: number | null;
  cityPeerBills: number | null;
  statePeerBills: number | null;
  itemsPerBill: number | null;
  peerItemsPerBill: number | null;
  cityPeerItemsPerBill: number | null;
  statePeerItemsPerBill: number | null;
};

function readMetric(value: unknown, nullable = false): number | null {
  if (nullable && value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000) return null;
  return value;
}

function deterministicSuggestion(metrics: Metrics) {
  const candidates = [
    { metric: "bills", group: "same-store", value: metrics.bills, average: metrics.peerBills },
    { metric: "bills", group: "city", value: metrics.bills, average: metrics.cityPeerBills },
    { metric: "bills", group: "state", value: metrics.bills, average: metrics.statePeerBills },
    { metric: "items per bill", group: "same-store", value: metrics.itemsPerBill, average: metrics.peerItemsPerBill },
    { metric: "items per bill", group: "city", value: metrics.itemsPerBill, average: metrics.cityPeerItemsPerBill },
    { metric: "items per bill", group: "state", value: metrics.itemsPerBill, average: metrics.statePeerItemsPerBill },
  ].filter((candidate): candidate is typeof candidate & { value: number; average: number } => candidate.value !== null && candidate.average !== null && candidate.average > candidate.value)
    .sort((a, b) => (b.average - b.value) / Math.max(b.average, 0.1) - (a.average - a.value) / Math.max(a.average, 0.1));
  const focus = candidates[0];
  if (!focus) return "Both measures are at or above available peer averages. Share one approach that works with a teammate, and keep tracking bills and items per bill against peers.";
  if (focus.metric === "items per bill") return `Items per bill are ${focus.value!.toFixed(2)} versus a ${focus.group} peer average of ${focus.average!.toFixed(2)}. Try one relevant accessory pairing in three fittings today, then review your item attachment rate with your manager.`;
  return `Bills are ${focus.value!.toFixed(0)} versus a ${focus.group} peer average of ${focus.average!.toFixed(1)}. Practise one opening question in three customer interactions today, then review your bill count with your manager.`;
}

export async function POST(request: Request) {
  let input: Record<string, unknown>;
  try { input = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "Invalid coaching metrics." }, { status: 400 }); }

  const metrics: Metrics = {
    bills: readMetric(input.bills) ?? -1,
    peerBills: readMetric(input.peerBills, true),
    cityPeerBills: readMetric(input.cityPeerBills, true),
    statePeerBills: readMetric(input.statePeerBills, true),
    itemsPerBill: readMetric(input.itemsPerBill, true),
    peerItemsPerBill: readMetric(input.peerItemsPerBill, true),
    cityPeerItemsPerBill: readMetric(input.cityPeerItemsPerBill, true),
    statePeerItemsPerBill: readMetric(input.statePeerItemsPerBill, true),
  };
  if (metrics.bills < 0 || Object.values(metrics).some((value) => value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0))) {
    return NextResponse.json({ error: "Coaching metrics must be non-negative numbers." }, { status: 400 });
  }

  const fallback = deterministicSuggestion(metrics);
  const focusMetrics = {
    bills: metrics.bills,
    peerBills: metrics.peerBills,
    cityPeerBills: metrics.cityPeerBills,
    statePeerBills: metrics.statePeerBills,
    itemsPerBill: metrics.itemsPerBill,
    peerItemsPerBill: metrics.peerItemsPerBill,
    cityPeerItemsPerBill: metrics.cityPeerItemsPerBill,
    statePeerItemsPerBill: metrics.statePeerItemsPerBill,
    baselineSuggestion: fallback,
  };
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ suggestion: fallback, note: "Gemini is not configured; using metric-based coaching." });

  try {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Write one concise, respectful salesperson coaching suggestion in plain English, maximum 60 words. Use only the supplied aggregate performance metrics and precomputed baselineSuggestion. Do not calculate or change any metric, invent causes or customer facts, mention customer identities, or include the salesperson's name. Preserve the baselineSuggestion's comparison and key numbers. Give one action for today and one measurable follow-up." }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(focusMetrics) }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 120 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return NextResponse.json({ suggestion: fallback, note: "Gemini was unavailable; using metric-based coaching." });
    const result = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const generated = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join(" ").trim();
    if (!generated) return NextResponse.json({ suggestion: fallback, note: "Gemini returned no suggestion; using metric-based coaching." });
    const suggestion = generated.split(/\s+/).slice(0, 60).join(" ");
    return NextResponse.json({ suggestion, note: "Personalized using verified peer metrics." });
  } catch {
    return NextResponse.json({ suggestion: fallback, note: "Gemini was unavailable; using metric-based coaching." });
  }
}
