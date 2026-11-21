import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { insertInBatches, parseAndValidateCsvBundle, parseAndValidateWorkbook, toDatabaseRows } from "@/lib/workbook";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(request: Request) {
  const expected = process.env.DATA_IMPORT_TOKEN ?? "";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Import access is not configured or the token is invalid." }, { status: 401 });
  }

  const form = await request.formData();
  const uploads = form.getAll("files").filter((value): value is File => value instanceof File);
  const mode = form.get("mode");
  const totalSize = uploads.reduce((total, file) => total + file.size, 0);
  if (uploads.length === 0 || (uploads.some((file) => !/\.(xlsx|csv)$/i.test(file.name)))) {
    return NextResponse.json({ error: "Choose the .xlsx workbook or all required .csv table files." }, { status: 400 });
  }
  if (uploads.filter((file) => /\.xlsx$/i.test(file.name)).length > 1 || (uploads.some((file) => /\.xlsx$/i.test(file.name)) && uploads.length > 1)) {
    return NextResponse.json({ error: "Upload one .xlsx workbook or a bundle of .csv files, not both." }, { status: 400 });
  }
  if (totalSize > 30 * 1024 * 1024) {
    return NextResponse.json({ error: "Workbook exceeds the 30 MB upload limit." }, { status: 413 });
  }

  try {
    const parsed = uploads[0].name.toLowerCase().endsWith(".xlsx")
      ? await parseAndValidateWorkbook(Buffer.from(await uploads[0].arrayBuffer()))
      : await parseAndValidateCsvBundle(await Promise.all(uploads.map(async (file) => ({ name: file.name, buffer: Buffer.from(await file.arrayBuffer()) }))));
    if (parsed.errors.length) {
      return NextResponse.json({ errors: parsed.errors, counts: parsed.counts }, { status: 422 });
    }
    const data = toDatabaseRows(parsed.rows);
    if ("error" in data) return NextResponse.json({ errors: [data.error] }, { status: 422 });
    if (mode === "preview") {
      return NextResponse.json({ counts: parsed.counts, ready: true, note: "Validation passed. No database rows were written." });
    }

    const prisma = getPrismaClient();
    const result = await prisma.$transaction(async (tx) => {
      const [storeCount, billCount] = await Promise.all([tx.store.count(), tx.bill.count()]);
      if (storeCount || billCount) throw new Error("DATABASE_NOT_EMPTY");

      await insertInBatches((batch) => tx.areaManager.createMany({ data: batch as never[] }), data.areaManagers);
      await insertInBatches((batch) => tx.store.createMany({ data: batch as never[] }), data.stores);
      await insertInBatches((batch) => tx.item.createMany({ data: batch as never[] }), data.items);
      await insertInBatches((batch) => tx.salesperson.createMany({ data: batch as never[] }), data.salespeople);
      await insertInBatches((batch) => tx.rosterDaily.createMany({ data: batch as never[] }), data.rosterDaily);
      await insertInBatches((batch) => tx.footfallDaily.createMany({ data: batch as never[] }), data.footfallDaily);
      await insertInBatches((batch) => tx.bill.createMany({ data: batch as never[] }), data.bills);
      await insertInBatches((batch) => tx.billLine.createMany({ data: batch as never[] }), data.billLines);
      await insertInBatches((batch) => tx.stockSnapshot.createMany({ data: batch as never[] }), data.stockSnapshot);
      await insertInBatches((batch) => tx.stockWeekly.createMany({ data: batch as never[] }), data.stockWeekly);
      await insertInBatches((batch) => tx.warehouseInbound.createMany({ data: batch as never[] }), data.warehouseInbound);
      await insertInBatches((batch) => tx.calendar.createMany({ data: batch as never[] }), data.calendar);
      await insertInBatches((batch) => tx.flagshipProtected.createMany({ data: batch as never[] }), data.flagshipProtected);
      await insertInBatches((batch) => tx.configurationRow.createMany({ data: batch as never[] }), data.configurationRows);
      return parsed.counts;
    }, { maxWait: 10_000, timeout: 240_000 });

    return NextResponse.json({ imported: true, counts: result });
  } catch (error) {
    if (error instanceof Error && error.message === "DATABASE_NOT_EMPTY") {
      return NextResponse.json({ error: "Import stopped because this database already has store or bill data. Existing data was not changed." }, { status: 409 });
    }
    return NextResponse.json({ error: "Workbook import failed. Check its data and database connection, then retry." }, { status: 500 });
  }
}
