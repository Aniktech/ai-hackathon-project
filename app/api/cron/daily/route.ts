import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runDailyAnalysis } from "@/lib/recommendations";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request) {
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const accepted = [process.env.CRON_SECRET, process.env.DATA_IMPORT_TOKEN].filter(Boolean) as string[];
  return accepted.some((expected) => {
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Scheduled analysis is not authorized." }, { status: 401 });
  try {
    return NextResponse.json(await runDailyAnalysis());
  } catch {
    return NextResponse.json({ error: "Daily analysis failed. Check the server configuration and imported data." }, { status: 500 });
  }
}
