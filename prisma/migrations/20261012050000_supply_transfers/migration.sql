ALTER TABLE "Stock" ADD COLUMN "released" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_release_range" CHECK ("released" >= 0 AND "released" <= "quantity");
CREATE TABLE "SupplyNeed" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "materialId" TEXT NOT NULL REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "quantity" DECIMAL(18,4) NOT NULL,
 "consumed" DECIMAL(18,4) NOT NULL DEFAULT 0,
 "neededOn" TIMESTAMP(3) NOT NULL,
 "leadDays" INTEGER NOT NULL,
 "purpose" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'OPEN',
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "SupplyNeed_quantity_range" CHECK ("quantity" > 0 AND "consumed" >= 0 AND "consumed" <= "quantity"),
 CONSTRAINT "SupplyNeed_leadDays_range" CHECK ("leadDays" >= 0 AND "leadDays" <= 365),
 CONSTRAINT "SupplyNeed_status_values" CHECK ("status" IN ('OPEN','FULFILLED','CANCELLED'))
);
CREATE INDEX "SupplyNeed_projectId_materialId_neededOn_idx" ON "SupplyNeed"("projectId","materialId","neededOn");
ALTER TABLE "Movement" ADD COLUMN "needId" TEXT;
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_needId_fkey" FOREIGN KEY ("needId") REFERENCES "SupplyNeed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "StockTransfer" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "number" SERIAL NOT NULL UNIQUE,
 "fromProjectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "toProjectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "materialId" TEXT NOT NULL REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "quantity" DECIMAL(18,4) NOT NULL,
 "unitCost" DECIMAL(18,4) NOT NULL,
 "reference" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'IN_TRANSIT',
 "dispatchedBy" TEXT NOT NULL,
 "receivedBy" TEXT,
 "receivedAt" TIMESTAMP(3),
 "receiptReference" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "StockTransfer_different_projects" CHECK ("fromProjectId" <> "toProjectId"),
 CONSTRAINT "StockTransfer_positive_quantity" CHECK ("quantity" > 0),
 CONSTRAINT "StockTransfer_status_values" CHECK ("status" IN ('IN_TRANSIT','RECEIVED'))
);
CREATE INDEX "StockTransfer_fromProjectId_status_idx" ON "StockTransfer"("fromProjectId","status");
CREATE INDEX "StockTransfer_toProjectId_status_idx" ON "StockTransfer"("toProjectId","status");
