import dotenv from "dotenv";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getPrismaClient } from "@/lib/prisma";
import { insertInBatches, parseAndValidateCsvBundle, toDatabaseRows } from "@/lib/workbook";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

async function main() {
  const directory = path.resolve(process.argv[2] ?? "data/source");
  const names = (await readdir(directory)).filter((name) => name.toLowerCase().endsWith(".csv"));
  const files = await Promise.all(names.map(async (name) => ({ name, buffer: await readFile(path.join(directory, name)) })));
  const parsed = await parseAndValidateCsvBundle(files);
  if (parsed.errors.length) {
    console.error("Dataset validation failed:");
    for (const error of parsed.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  const data = toDatabaseRows(parsed.rows);
  if ("error" in data) {
    console.error(`Dataset contains an invalid field: ${data.error}`);
    process.exitCode = 1;
    return;
  }

  const prisma = getPrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      const [storeCount, billCount] = await Promise.all([tx.store.count(), tx.bill.count()]);
      if (storeCount || billCount) throw new Error("DATABASE_NOT_EMPTY");
      const insert = async (name: string, createMany: (batch: never[]) => Promise<unknown>, rows: unknown[]) => {
        console.log(`Importing ${name}: ${rows.length.toLocaleString("en-IN")} rows`);
        await insertInBatches(createMany, rows);
      };
      await insert("area_managers", (batch) => tx.areaManager.createMany({ data: batch as never[] }), data.areaManagers);
      await insert("stores", (batch) => tx.store.createMany({ data: batch as never[] }), data.stores);
      await insert("items", (batch) => tx.item.createMany({ data: batch as never[] }), data.items);
      await insert("salespeople", (batch) => tx.salesperson.createMany({ data: batch as never[] }), data.salespeople);
      await insert("roster_daily", (batch) => tx.rosterDaily.createMany({ data: batch as never[] }), data.rosterDaily);
      await insert("footfall_daily", (batch) => tx.footfallDaily.createMany({ data: batch as never[] }), data.footfallDaily);
      await insert("bills", (batch) => tx.bill.createMany({ data: batch as never[] }), data.bills);
      await insert("bill_lines", (batch) => tx.billLine.createMany({ data: batch as never[] }), data.billLines);
      await insert("stock_snapshot", (batch) => tx.stockSnapshot.createMany({ data: batch as never[] }), data.stockSnapshot);
      await insert("stock_weekly", (batch) => tx.stockWeekly.createMany({ data: batch as never[] }), data.stockWeekly);
      await insert("warehouse_inbound", (batch) => tx.warehouseInbound.createMany({ data: batch as never[] }), data.warehouseInbound);
      await insert("calendar", (batch) => tx.calendar.createMany({ data: batch as never[] }), data.calendar);
      await insert("flagship_protected", (batch) => tx.flagshipProtected.createMany({ data: batch as never[] }), data.flagshipProtected);
      await insert("configuration_rows", (batch) => tx.configurationRow.createMany({ data: batch as never[] }), data.configurationRows);
    }, { maxWait: 10_000, timeout: 240_000 });
    console.log("Dataset import completed successfully.");
    console.log(JSON.stringify(parsed.counts));
  } catch (error) {
    if (error instanceof Error && error.message === "DATABASE_NOT_EMPTY") {
      console.error("Import stopped: the database already contains store or bill data. No rows were changed.");
    } else {
      const fields = error && typeof error === "object" ? error as { name?: string; code?: string; cause?: { name?: string; code?: string } } : {};
      console.error(`Import failed and the transaction was rolled back (${fields.name ?? "Error"}${fields.code ? `, ${fields.code}` : ""}${fields.cause?.code ? `, cause ${fields.cause.code}` : ""}). Check database access and source data.`);
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
