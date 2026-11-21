import { NextResponse } from "next/server";
import { getOverview } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getOverview());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analytics failure";
    const fields = error && typeof error === "object" ? error as { name?: string; code?: string; cause?: { name?: string; code?: string } } : {};
    console.error("Store Coach analytics unavailable:", JSON.stringify({ name: fields.name, code: fields.code, causeName: fields.cause?.name, causeCode: fields.cause?.code, message: message.replace(/postgres(?:ql)?:\/\/[^\s\"']+/gi, "[redacted connection string]").replace(/(password|api[_-]?key|token)=([^&\s]+)/gi, "$1=[redacted]") }));
    return NextResponse.json({ available: false, error: "Analytics are unavailable until the database is configured and a valid dataset is imported." }, { status: 503 });
  }
}
