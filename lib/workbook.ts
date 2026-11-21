import ExcelJS from "exceljs";
import { Readable } from "node:stream";
import { parse } from "@fast-csv/parse";

const requiredSheets = [
  "stores", "area_managers", "items", "salespeople", "roster_daily",
  "footfall_daily", "bills", "bill_lines", "stock_snapshot", "stock_weekly",
  "warehouse_inbound", "calendar", "rules", "min_display", "lead_times", "flagship_protected",
] as const;

const requiredColumns: Record<string, string[]> = {
  stores: ["store_id", "city", "state", "zone", "tier", "size_sqft", "stock_capacity_units", "opened_on", "area_manager_id"],
  area_managers: ["area_manager_id", "name", "city"],
  items: ["sku_id", "style_id", "style_name", "category", "size", "mrp", "cost_price", "launch_date", "is_core_style", "is_packaging"],
  salespeople: ["salesperson_id", "store_id", "name", "join_date"],
  roster_daily: ["date", "store_id", "salesperson_id", "status"],
  footfall_daily: ["date", "store_id", "footfall"],
  bills: ["bill_id", "bill_date", "store_id", "salesperson_id", "customer_id"],
  bill_lines: ["bill_id", "sku_id", "qty", "mrp", "selling_price"],
  stock_snapshot: ["as_of_date", "location_id", "sku_id", "on_hand", "in_transit"],
  stock_weekly: ["week_ending", "store_id", "sku_id", "closing_on_hand", "days_in_stock"],
  warehouse_inbound: ["expected_date", "sku_id", "qty", "status"],
  calendar: ["date", "state", "festival", "is_wedding_date"],
  flagship_protected: ["store_id", "rank", "style_id"],
};

type Row = Record<string, unknown>;
export type ParsedWorkbook = Record<string, Row[]>;

function keyOf(value: unknown): string {
  return String(value ?? "").trim().replace(/^\uFEFF/, "").toLowerCase().replace(/[\s-]+/g, "_");
}

function cellValue(value: ExcelJS.CellValue): unknown {
  if (value instanceof Date) return value;
  if (value && typeof value === "object") {
    if ("result" in value) return value.result;
    if ("text" in value) return value.text;
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
  }
  return value;
}

function parseSheet(worksheet: ExcelJS.Worksheet): Row[] {
  const headers = worksheet.getRow(1).values as unknown[];
  const names = headers.slice(1).map(keyOf);
  const rows: Row[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Row = {};
    let nonEmpty = false;
    names.forEach((name, index) => {
      if (!name) return;
      const value = cellValue(row.getCell(index + 1).value);
      if (value !== null && value !== undefined && value !== "") nonEmpty = true;
      record[name] = value;
    });
    if (nonEmpty) rows.push(record);
  });
  return rows;
}

function asDate(value: unknown, field: string): Date {
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value === "number") date = new Date(Date.UTC(1899, 11, 30) + value * 86_400_000);
  else date = new Date(String(value ?? ""));
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid date in ${field}.`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function number(value: unknown, field: string, integer = false): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/[₹,\s]/g, ""));
  if (!Number.isFinite(parsed) || (integer && !Number.isInteger(parsed))) throw new Error(`Invalid number in ${field}.`);
  return parsed;
}

function text(value: unknown, field: string): string {
  const parsed = String(value ?? "").trim();
  if (!parsed) throw new Error(`Missing value in ${field}.`);
  return parsed;
}

function bool(value: unknown, field: string): boolean {
  if (value === true || value === 1 || String(value).trim() === "1" || String(value).toLowerCase() === "true") return true;
  if (value === false || value === 0 || String(value).trim() === "0" || String(value).toLowerCase() === "false") return false;
  throw new Error(`Expected 1/0 or true/false in ${field}.`);
}

function optionalDate(value: unknown, field: string): Date | null {
  return value === null || value === undefined || value === "" ? null : asDate(value, field);
}

function optionalText(value: unknown): string | null {
  const parsed = String(value ?? "").trim();
  return parsed || null;
}

function validateRows(rows: ParsedWorkbook, headerRows: Map<string, string[]>) {
  const errors: string[] = [];

  for (const name of requiredSheets) {
    const data = rows[name];
    if (!data) {
      if (requiredSheets.includes(name as (typeof requiredSheets)[number])) errors.push(`Missing sheet: ${name}`);
      continue;
    }
    const headers = new Set(headerRows.get(name) ?? []);
    for (const column of requiredColumns[name] ?? []) {
      if (!headers.has(column)) errors.push(`${name}: missing column “${column}”.`);
    }
    if (data.length === 0 && requiredSheets.includes(name as (typeof requiredSheets)[number])) errors.push(`${name}: no data rows found.`);
  }

  const counts = Object.fromEntries(Object.entries(rows).map(([name, data]) => [name, data.length]));
  return { rows, counts, errors };
}

export async function parseAndValidateWorkbook(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  const workbookData = Uint8Array.from(buffer).buffer;
  await workbook.xlsx.load(workbookData);
  const rows: ParsedWorkbook = {};
  const headers = new Map<string, string[]>();
  for (const worksheet of workbook.worksheets) {
    const name = keyOf(worksheet.name);
    rows[name] = parseSheet(worksheet);
    headers.set(name, ((worksheet.getRow(1).values as unknown[]).slice(1).map(keyOf)));
  }
  return validateRows(rows, headers);
}

export async function parseAndValidateCsvBundle(files: Array<{ name: string; buffer: Buffer }>) {
  const rows: ParsedWorkbook = {};
  const headers = new Map<string, string[]>();
  for (const file of files) {
    const name = keyOf(file.name.replace(/\.csv$/i, ""));
    if (name in rows) throw new Error(`Duplicate CSV table: ${name}`);
    rows[name] = [];
    await new Promise<void>((resolve, reject) => {
      const csv = Readable.from([file.buffer]).pipe(parse({ headers: (values) => values.map(keyOf), trim: true, ignoreEmpty: true, strictColumnHandling: true }));
      csv.on("headers", (values: string[]) => headers.set(name, values.map(keyOf)));
      csv.on("data", (record: Row) => rows[name].push(record));
      csv.on("error", reject);
      csv.on("end", resolve);
    });
  }
  return validateRows(rows, headers);
}

export function toDatabaseRows(rows: ParsedWorkbook) {
  const map = (sheet: string, fn: (row: Row) => unknown) => (rows[sheet] ?? []).map(fn);
  try {
    return {
      areaManagers: map("area_managers", (r) => ({ areaManagerId: text(r.area_manager_id, "area_managers.area_manager_id"), name: text(r.name, "area_managers.name"), city: text(r.city, "area_managers.city"), maxAlertsPerWeek: r.max_alerts_per_week == null ? 5 : number(r.max_alerts_per_week, "max_alerts_per_week", true) })),
      stores: map("stores", (r) => ({ storeId: text(r.store_id, "stores.store_id"), city: text(r.city, "stores.city"), state: text(r.state, "stores.state"), zone: text(r.zone, "stores.zone"), tier: text(r.tier, "stores.tier"), sizeSqft: number(r.size_sqft, "size_sqft", true), stockCapacityUnits: number(r.stock_capacity_units, "stock_capacity_units", true), openedOn: asDate(r.opened_on, "opened_on"), areaManagerId: text(r.area_manager_id, "area_manager_id") })),
      items: map("items", (r) => ({ skuId: text(r.sku_id, "sku_id"), styleId: text(r.style_id, "style_id"), styleName: text(r.style_name, "style_name"), category: text(r.category, "category"), size: text(r.size, "size"), mrp: number(r.mrp, "mrp"), costPrice: number(r.cost_price, "cost_price"), launchDate: optionalDate(r.launch_date, "launch_date"), isCoreStyle: bool(r.is_core_style, "is_core_style"), isPackaging: bool(r.is_packaging, "is_packaging") })),
      salespeople: map("salespeople", (r) => ({ salespersonId: text(r.salesperson_id, "salesperson_id"), storeId: text(r.store_id, "store_id"), name: text(r.name, "name"), joinDate: asDate(r.join_date, "join_date") })),
      rosterDaily: map("roster_daily", (r) => ({ date: asDate(r.date, "roster_daily.date"), storeId: text(r.store_id, "store_id"), salespersonId: text(r.salesperson_id, "salesperson_id"), status: text(r.status, "status") })),
      footfallDaily: map("footfall_daily", (r) => ({ date: asDate(r.date, "footfall_daily.date"), storeId: text(r.store_id, "store_id"), footfall: number(r.footfall, "footfall", true) })),
      bills: map("bills", (r) => ({ billId: text(r.bill_id, "bill_id"), billDate: asDate(r.bill_date, "bill_date"), storeId: text(r.store_id, "store_id"), salespersonId: text(r.salesperson_id, "salesperson_id"), customerId: text(r.customer_id, "customer_id") })),
      billLines: map("bill_lines", (r) => ({ billId: text(r.bill_id, "bill_id"), skuId: text(r.sku_id, "sku_id"), quantity: number(r.qty, "qty", true), mrp: number(r.mrp, "mrp"), sellingPrice: number(r.selling_price, "selling_price") })),
      stockSnapshot: map("stock_snapshot", (r) => ({ asOfDate: asDate(r.as_of_date, "as_of_date"), locationId: text(r.location_id, "location_id"), skuId: text(r.sku_id, "sku_id"), onHand: number(r.on_hand, "on_hand", true), inTransit: number(r.in_transit, "in_transit", true), inTransitArrivesOn: optionalDate(r.in_transit_arrives_on, "in_transit_arrives_on"), oldestStockReceivedOn: optionalDate(r.oldest_stock_received_on, "oldest_stock_received_on") })),
      stockWeekly: map("stock_weekly", (r) => ({ weekEnding: asDate(r.week_ending, "week_ending"), storeId: text(r.store_id, "store_id"), skuId: text(r.sku_id, "sku_id"), closingOnHand: number(r.closing_on_hand, "closing_on_hand", true), daysInStock: number(r.days_in_stock, "days_in_stock", true) })),
      warehouseInbound: map("warehouse_inbound", (r) => ({ expectedDate: asDate(r.expected_date, "expected_date"), skuId: text(r.sku_id, "sku_id"), quantity: number(r.qty, "qty", true), status: text(r.status, "status") })),
      calendar: map("calendar", (r) => ({ date: asDate(r.date, "calendar.date"), state: text(r.state, "state"), festival: optionalText(r.festival), isWeddingDate: bool(r.is_wedding_date, "is_wedding_date") })),
      flagshipProtected: map("flagship_protected", (r) => ({ storeId: text(r.store_id, "store_id"), rank: number(r.rank, "rank", true), styleId: text(r.style_id, "style_id") })),
      configurationRows: ["rules", "min_display", "lead_times"].flatMap((sheet) => (rows[sheet] ?? []).map((payload, index) => ({ sheet: sheet.toUpperCase(), rowNumber: index + 1, payload: JSON.parse(JSON.stringify(payload, (_key, value) => value instanceof Date ? value.toISOString() : value)) }))),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid workbook value." };
  }
}

export async function insertInBatches(createMany: (data: never[]) => Promise<unknown>, rows: unknown[], size = 1000) {
  for (let offset = 0; offset < rows.length; offset += size) {
    await createMany(rows.slice(offset, offset + size) as never[]);
  }
}
