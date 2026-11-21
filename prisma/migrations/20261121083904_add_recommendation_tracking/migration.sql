-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "run_date" DATE NOT NULL,
    "owner_type" VARCHAR(24) NOT NULL,
    "owner_id" VARCHAR(64) NOT NULL,
    "area_manager_id" VARCHAR(32) NOT NULL,
    "store_id" VARCHAR(32) NOT NULL,
    "lever" VARCHAR(32) NOT NULL,
    "cause" TEXT NOT NULL,
    "opportunity" DECIMAL(14,2) NOT NULL,
    "action" TEXT NOT NULL,
    "baseline_value" DOUBLE PRECISION NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'open',
    "outcome_value" DOUBLE PRECISION,
    "outcome_recorded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recommendations_run_date_area_manager_id_idx" ON "recommendations"("run_date", "area_manager_id");

-- CreateIndex
CREATE INDEX "recommendations_status_run_date_idx" ON "recommendations"("status", "run_date");

-- CreateIndex
CREATE UNIQUE INDEX "recommendations_run_date_owner_type_owner_id_lever_key" ON "recommendations"("run_date", "owner_type", "owner_id", "lever");

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_area_manager_id_fkey" FOREIGN KEY ("area_manager_id") REFERENCES "area_managers"("area_manager_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("store_id") ON DELETE RESTRICT ON UPDATE CASCADE;
