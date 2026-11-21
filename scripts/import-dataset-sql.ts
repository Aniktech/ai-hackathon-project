import dotenv from "dotenv";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseAndValidateCsvBundle, toDatabaseRows } from "@/lib/workbook";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

type Row = Record<string, unknown>;

function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return "'" + value.toISOString().slice(0, 10) + "'";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Invalid numeric value.");
    return String(value);
  }
  if (typeof value === "object") return literal(JSON.stringify(value)) + "::jsonb";
  return "'" + String(value).replace(/\0/g, "").replace(/'/g, "''") + "'";
}

function insertSql(table: string, columns: string[], rows: Row[], fields: string[], batchSize = 500) {
  const statements: string[] = [];
  const columnList = columns.map((column) => '"' + column + '"').join(",");
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const values = rows.slice(offset, offset + batchSize).map((row) => "(" + fields.map((field) => literal(row[field])).join(",") + ")");
    statements.push('INSERT INTO "' + table + '" (' + columnList + ") VALUES\n" + values.join(",\n") + ";");
  }
  return statements.join("\n");
}

async function main() {
  const directory = path.resolve(process.argv[2] ?? "data/source");
  const output = path.resolve("data/.dataset-import.sql");
  if (existsSync(output)) throw new Error("Temporary import SQL already exists; refusing to overwrite it.");

  const names = (await readdir(directory)).filter((name) => name.toLowerCase().endsWith(".csv"));
  const files = await Promise.all(names.map(async (name) => ({ name, buffer: await readFile(path.join(directory, name)) })));
  const parsed = await parseAndValidateCsvBundle(files);
  if (parsed.errors.length) {
    console.error("Dataset validation failed:");
    for (const error of parsed.errors) console.error("- " + error);
    process.exitCode = 1;
    return;
  }
  const data = toDatabaseRows(parsed.rows);
  if ("error" in data) {
    console.error("Dataset contains an invalid field: " + data.error);
    process.exitCode = 1;
    return;
  }

  const tables: Array<{ table: string; columns: string[]; fields: string[]; rows: Row[] }> = [
    { table: "area_managers", columns: ["area_manager_id", "name", "city", "max_alerts_per_week"], fields: ["areaManagerId", "name", "city", "maxAlertsPerWeek"], rows: data.areaManagers as Row[] },
    { table: "stores", columns: ["store_id", "city", "state", "zone", "tier", "size_sqft", "stock_capacity_units", "opened_on", "area_manager_id"], fields: ["storeId", "city", "state", "zone", "tier", "sizeSqft", "stockCapacityUnits", "openedOn", "areaManagerId"], rows: data.stores as Row[] },
    { table: "items", columns: ["sku_id", "style_id", "style_name", "category", "size", "mrp", "cost_price", "launch_date", "is_core_style", "is_packaging"], fields: ["skuId", "styleId", "styleName", "category", "size", "mrp", "costPrice", "launchDate", "isCoreStyle", "isPackaging"], rows: data.items as Row[] },
    { table: "salespeople", columns: ["salesperson_id", "store_id", "name", "join_date"], fields: ["salespersonId", "storeId", "name", "joinDate"], rows: data.salespeople as Row[] },
    { table: "roster_daily", columns: ["date", "store_id", "salesperson_id", "status"], fields: ["date", "storeId", "salespersonId", "status"], rows: data.rosterDaily as Row[] },
    { table: "footfall_daily", columns: ["date", "store_id", "footfall"], fields: ["date", "storeId", "footfall"], rows: data.footfallDaily as Row[] },
    { table: "bills", columns: ["bill_id", "bill_date", "store_id", "salesperson_id", "customer_id"], fields: ["billId", "billDate", "storeId", "salespersonId", "customerId"], rows: data.bills as Row[] },
    { table: "bill_lines", columns: ["bill_id", "sku_id", "qty", "mrp", "selling_price"], fields: ["billId", "skuId", "quantity", "mrp", "sellingPrice"], rows: data.billLines as Row[] },
    { table: "stock_snapshot", columns: ["as_of_date", "location_id", "sku_id", "on_hand", "in_transit", "in_transit_arrives_on", "oldest_stock_received_on"], fields: ["asOfDate", "locationId", "skuId", "onHand", "inTransit", "inTransitArrivesOn", "oldestStockReceivedOn"], rows: data.stockSnapshot as Row[] },
    { table: "stock_weekly", columns: ["week_ending", "store_id", "sku_id", "closing_on_hand", "days_in_stock"], fields: ["weekEnding", "storeId", "skuId", "closingOnHand", "daysInStock"], rows: data.stockWeekly as Row[] },
    { table: "warehouse_inbound", columns: ["expected_date", "sku_id", "qty", "status"], fields: ["expectedDate", "skuId", "quantity", "status"], rows: data.warehouseInbound as Row[] },
    { table: "calendar", columns: ["date", "state", "festival", "is_wedding_date"], fields: ["date", "state", "festival", "isWeddingDate"], rows: data.calendar as Row[] },
    { table: "flagship_protected", columns: ["store_id", "rank", "style_id"], fields: ["storeId", "rank", "styleId"], rows: data.flagshipProtected as Row[] },
    { table: "configuration_rows", columns: ["sheet", "row_number", "payload"], fields: ["sheet", "rowNumber", "payload"], rows: (data.configurationRows as Row[]).map((row) => ({ ...row, sheet: String(row.sheet).toLowerCase() })) },
  ];

  const expected: Record<string, number> = { area_managers: 6, stores: 20, items: 385, salespeople: 175, roster_daily: 23569, footfall_daily: 13892, bills: 90805, bill_lines: 259772, stock_snapshot: 3547, stock_weekly: 61416, warehouse_inbound: 768, calendar: 2373, flagship_protected: 80, configuration_rows: 38 };
  const assertions = Object.entries(expected).map(([table, count]) => 'IF (SELECT COUNT(*) FROM "' + table + '") <> ' + count + " THEN RAISE EXCEPTION 'Unexpected row count in " + table + "'; END IF;").join("\n");
  const sql = [
    "BEGIN;",
    "DO $$ BEGIN IF EXISTS (SELECT 1 FROM stores) OR EXISTS (SELECT 1 FROM bills) THEN RAISE EXCEPTION 'DATABASE_NOT_EMPTY; no data changed'; END IF; END $$;",
    ...tables.map((table) => insertSql(table.table, table.columns, table.rows, table.fields)),
    "DO $$ BEGIN\n" + assertions + "\nEND $$;",
    "COMMIT;",
  ].join("\n");

  await writeFile(output, sql, { encoding: "utf8", flag: "wx" });
  try {
    console.log("Submitting validated dataset in one guarded database transaction.");
    const prismaCli = path.resolve("node_modules/prisma/build/index.js");
    const result = spawnSync(process.execPath, [prismaCli, "db", "execute", "--file", output], { cwd: process.cwd(), encoding: "utf8", timeout: 300_000, maxBuffer: 2 * 1024 * 1024 });
    if (result.status !== 0) {
      process.exitCode = 1;
      console.error("Database import failed; no row-count assertions passed. No credentials were printed.");
      const diagnostic = String(result.stderr || result.stdout || "").replace(/postgres(?:ql)?:\/\/[^\s\"']+/gi, "[redacted connection string]").replace(/(password|api[_-]?key|token)=([^&\s]+)/gi, "$1=[redacted]").replace(/\bC\d{8}\b/g, "[customer id]").replace(/\bB\d+\b/g, "[bill id]").replace(/\bSP\d+\b/g, "[staff id]");
      const lines = diagnostic.split(/\r?\n/).filter((line) => /^(Error:|Script execution|Datasource|Loaded Prisma|error code:)/i.test(line.trim())).slice(-5);
      if (lines.length) console.error("Prisma status:", lines.join(" ").slice(0, 800));
      return;
    }
    console.log("Dataset import succeeded. Foreign keys and expected row counts passed inside the transaction.");
  } finally {
    await rm(output, { force: true });
  }
}

void main().catch(() => {
  console.error("Dataset import preparation failed. No database rows were written.");
  process.exitCode = 1;
});
