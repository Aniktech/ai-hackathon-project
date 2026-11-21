import { NextResponse } from "next/server";
import { explainIssue, getOverview } from "@/lib/analytics";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let storeId = "";
  try {
    const body = await request.json() as { storeId?: unknown };
    storeId = typeof body.storeId === "string" ? body.storeId.slice(0, 32) : "";
    if (!storeId) return NextResponse.json({ error: "A store ID is required." }, { status: 400 });
    const overview = await getOverview();
    const store = overview.stores.find((item) => item.storeId === storeId);
    if (!store || !overview.available) return NextResponse.json({ error: "No validated analytics are available for this store." }, { status: 404 });

    const gap = Math.max(0, (store.peerConversion ?? store.conversion ?? 0) - (store.conversion ?? 0));
    const fallback = explainIssue({ storeId, lever: "store conversion", amount: store.conversionOpportunity, gap });
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ explanation: fallback, aiUsed: false, note: "Add a Gemini key to enable AI-written explanations." });

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Explain verified retail metrics for a store manager in plain language. Do not calculate or change metrics. Give one low-cost action that can happen today. Do not mention customer identities. Maximum 60 words." }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify({ store: store.storeId, city: store.city, tier: store.tier, bills: store.bills, conversionRate: store.conversion, peerConversionRate: store.peerConversion, computedRevenueOpportunityINR: store.conversionOpportunity }) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 120 },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return NextResponse.json({ explanation: fallback, aiUsed: false, note: "Gemini was unavailable; the verified deterministic explanation is shown." });
    const result = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const explanation = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join(" ").trim();
    if (!explanation) return NextResponse.json({ explanation: fallback, aiUsed: false });
    return NextResponse.json({ explanation, aiUsed: true });
  } catch {
    return NextResponse.json({ error: "Could not create an explanation." }, { status: 500 });
  }
}
