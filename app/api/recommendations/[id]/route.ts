import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";

function authorized(request: Request) {
  const expected = process.env.DATA_IMPORT_TOKEN ?? "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!authorized(request)) return NextResponse.json({ error: "Action update is not authorized." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[a-zA-Z0-9_-]{8,40}$/.test(id)) return NextResponse.json({ error: "Invalid recommendation ID." }, { status: 400 });
  let body: { status?: unknown; outcomeValue?: unknown };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (body.status !== "completed" && body.status !== "dismissed") return NextResponse.json({ error: "Status must be completed or dismissed." }, { status: 400 });
  const outcomeValue = body.status === "completed" ? Number(body.outcomeValue) : null;
  if (body.status === "completed" && !Number.isFinite(outcomeValue)) return NextResponse.json({ error: "Enter the measured result before completing the follow-up." }, { status: 400 });
  try {
    const record = await getPrismaClient().recommendation.update({
      where: { id },
      data: { status: body.status, outcomeValue, outcomeRecordedAt: body.status === "completed" ? new Date() : null },
      select: { id: true, status: true },
    });
    return NextResponse.json(record);
  } catch {
    return NextResponse.json({ error: "Recommendation not found or could not be updated." }, { status: 404 });
  }
}
