-- CreateEnum
CREATE TYPE "ConfigurationSheet" AS ENUM ('rules', 'min_display', 'lead_times');

-- CreateTable
CREATE TABLE "area_managers" (
    "area_manager_id" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "max_alerts_per_week" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "area_managers_pkey" PRIMARY KEY ("area_manager_id")
);

-- CreateTable
CREATE TABLE "stores" (
    "store_id" VARCHAR(32) NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "state" VARCHAR(120) NOT NULL,
    "zone" VARCHAR(32) NOT NULL,
    "tier" VARCHAR(16) NOT NULL,
    "size_sqft" INTEGER NOT NULL,
    "stock_capacity_units" INTEGER NOT NULL,
    "opened_on" DATE NOT NULL,
    "area_manager_id" VARCHAR(32) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("store_id")
);

-- CreateTable
CREATE TABLE "items" (
    "sku_id" VARCHAR(64) NOT NULL,
    "style_id" VARCHAR(64) NOT NULL,
    "style_name" VARCHAR(240) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "size" VARCHAR(32) NOT NULL,
    "mrp" DECIMAL(12,2) NOT NULL,
    "cost_price" DECIMAL(12,2) NOT NULL,
    "launch_date" DATE NOT NULL,
    "is_core_style" BOOLEAN NOT NULL,
    "is_packaging" BOOLEAN NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("sku_id")
);

-- CreateTable
CREATE TABLE "salespeople" (
    "salesperson_id" VARCHAR(32) NOT NULL,
    "store_id" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "join_date" DATE NOT NULL,

    CONSTRAINT "salespeople_pkey" PRIMARY KEY ("salesperson_id")
);

-- CreateTable
CREATE TABLE "roster_daily" (
    "date" DATE NOT NULL,
    "store_id" VARCHAR(32) NOT NULL,
    "salesperson_id" VARCHAR(32) NOT NULL,
    "status" VARCHAR(24) NOT NULL,

    CONSTRAINT "roster_daily_pkey" PRIMARY KEY ("date","store_id","salesperson_id")
);

-- CreateTable
CREATE TABLE "footfall_daily" (
    "date" DATE NOT NULL,
    "store_id" VARCHAR(32) NOT NULL,
    "footfall" INTEGER NOT NULL,

    CONSTRAINT "footfall_daily_pkey" PRIMARY KEY ("date","store_id")
);

-- CreateTable
CREATE TABLE "bills" (
    "bill_id" VARCHAR(64) NOT NULL,
    "bill_date" DATE NOT NULL,
    "store_id" VARCHAR(32) NOT NULL,
    "salesperson_id" VARCHAR(32) NOT NULL,
    "customer_id" VARCHAR(128) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("bill_id")
);

-- CreateTable
CREATE TABLE "bill_lines" (
    "bill_id" VARCHAR(64) NOT NULL,
    "sku_id" VARCHAR(64) NOT NULL,
    "qty" INTEGER NOT NULL,
    "mrp" DECIMAL(12,2) NOT NULL,
    "selling_price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "bill_lines_pkey" PRIMARY KEY ("bill_id","sku_id")
);

-- CreateTable
CREATE TABLE "stock_snapshot" (
    "as_of_date" DATE NOT NULL,
    "location_id" VARCHAR(32) NOT NULL,
    "sku_id" VARCHAR(64) NOT NULL,
    "on_hand" INTEGER NOT NULL,
    "in_transit" INTEGER NOT NULL,
    "in_transit_arrives_on" DATE,
    "oldest_stock_received_on" DATE,

    CONSTRAINT "stock_snapshot_pkey" PRIMARY KEY ("as_of_date","location_id","sku_id")
);

-- CreateTable
CREATE TABLE "stock_weekly" (
    "week_ending" DATE NOT NULL,
    "store_id" VARCHAR(32) NOT NULL,
    "sku_id" VARCHAR(64) NOT NULL,
    "closing_on_hand" INTEGER NOT NULL,
    "days_in_stock" INTEGER NOT NULL,

    CONSTRAINT "stock_weekly_pkey" PRIMARY KEY ("week_ending","store_id","sku_id")
);

-- CreateTable
CREATE TABLE "warehouse_inbound" (
    "id" SERIAL NOT NULL,
    "expected_date" DATE NOT NULL,
    "sku_id" VARCHAR(64) NOT NULL,
    "qty" INTEGER NOT NULL,
    "status" VARCHAR(32) NOT NULL,

    CONSTRAINT "warehouse_inbound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar" (
    "date" DATE NOT NULL,
    "state" VARCHAR(120) NOT NULL,
    "festival" VARCHAR(160),
    "is_wedding_date" BOOLEAN NOT NULL,

    CONSTRAINT "calendar_pkey" PRIMARY KEY ("date","state")
);

-- CreateTable
CREATE TABLE "configuration_rows" (
    "sheet" "ConfigurationSheet" NOT NULL,
    "row_number" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "configuration_rows_pkey" PRIMARY KEY ("sheet","row_number")
);

-- CreateTable
CREATE TABLE "flagship_protected" (
    "store_id" VARCHAR(32) NOT NULL,
    "rank" INTEGER NOT NULL,
    "style_id" VARCHAR(64) NOT NULL,

    CONSTRAINT "flagship_protected_pkey" PRIMARY KEY ("store_id","rank")
);

-- CreateIndex
CREATE INDEX "stores_area_manager_id_idx" ON "stores"("area_manager_id");

-- CreateIndex
CREATE INDEX "stores_state_city_tier_idx" ON "stores"("state", "city", "tier");

-- CreateIndex
CREATE INDEX "items_style_id_idx" ON "items"("style_id");

-- CreateIndex
CREATE INDEX "items_category_launch_date_idx" ON "items"("category", "launch_date");

-- CreateIndex
CREATE INDEX "salespeople_store_id_join_date_idx" ON "salespeople"("store_id", "join_date");

-- CreateIndex
CREATE INDEX "roster_daily_store_id_date_status_idx" ON "roster_daily"("store_id", "date", "status");

-- CreateIndex
CREATE INDEX "roster_daily_salesperson_id_date_idx" ON "roster_daily"("salesperson_id", "date");

-- CreateIndex
CREATE INDEX "bills_store_id_bill_date_idx" ON "bills"("store_id", "bill_date");

-- CreateIndex
CREATE INDEX "bills_salesperson_id_bill_date_idx" ON "bills"("salesperson_id", "bill_date");

-- CreateIndex
CREATE INDEX "bills_customer_id_bill_date_idx" ON "bills"("customer_id", "bill_date");

-- CreateIndex
CREATE INDEX "bill_lines_sku_id_bill_id_idx" ON "bill_lines"("sku_id", "bill_id");

-- CreateIndex
CREATE INDEX "stock_snapshot_location_id_sku_id_idx" ON "stock_snapshot"("location_id", "sku_id");

-- CreateIndex
CREATE INDEX "stock_weekly_store_id_week_ending_idx" ON "stock_weekly"("store_id", "week_ending");

-- CreateIndex
CREATE INDEX "stock_weekly_sku_id_week_ending_idx" ON "stock_weekly"("sku_id", "week_ending");

-- CreateIndex
CREATE INDEX "warehouse_inbound_expected_date_sku_id_idx" ON "warehouse_inbound"("expected_date", "sku_id");

-- CreateIndex
CREATE INDEX "warehouse_inbound_status_expected_date_idx" ON "warehouse_inbound"("status", "expected_date");

-- CreateIndex
CREATE UNIQUE INDEX "flagship_protected_store_id_style_id_key" ON "flagship_protected"("store_id", "style_id");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_area_manager_id_fkey" FOREIGN KEY ("area_manager_id") REFERENCES "area_managers"("area_manager_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salespeople" ADD CONSTRAINT "salespeople_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_daily" ADD CONSTRAINT "roster_daily_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roster_daily" ADD CONSTRAINT "roster_daily_salesperson_id_fkey" FOREIGN KEY ("salesperson_id") REFERENCES "salespeople"("salesperson_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "footfall_daily" ADD CONSTRAINT "footfall_daily_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_salesperson_id_fkey" FOREIGN KEY ("salesperson_id") REFERENCES "salespeople"("salesperson_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("bill_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "items"("sku_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_snapshot" ADD CONSTRAINT "stock_snapshot_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "items"("sku_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_weekly" ADD CONSTRAINT "stock_weekly_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_weekly" ADD CONSTRAINT "stock_weekly_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "items"("sku_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_inbound" ADD CONSTRAINT "warehouse_inbound_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "items"("sku_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flagship_protected" ADD CONSTRAINT "flagship_protected_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;
