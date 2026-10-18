-- CreateTable
CREATE TABLE "ExperienceFamily" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "conditions" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperienceFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceRecord" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "projectId" TEXT NOT NULL,
    "budgetItemId" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "frontKey" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "isTest" BOOLEAN NOT NULL DEFAULT true,
    "coverage" TEXT NOT NULL,
    "laborCost" DECIMAL(18,2) NOT NULL,
    "equipmentCost" DECIMAL(18,2) NOT NULL,
    "otherCost" DECIMAL(18,2) NOT NULL,
    "laborHours" DECIMAL(18,4),
    "costReference" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "plannedUnitPrice" DECIMAL(18,4) NOT NULL,
    "budgetSnapshot" JSONB NOT NULL,
    "budgetHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECORDED',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "author" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperienceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceAllocation" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "ExperienceAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceEvent" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperienceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExperienceFamily_code_version_key" ON "ExperienceFamily"("code", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ExperienceRecord_number_key" ON "ExperienceRecord"("number");

-- CreateIndex
CREATE INDEX "ExperienceRecord_budgetItemId_status_idx" ON "ExperienceRecord"("budgetItemId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExperienceRecord_projectId_reference_key" ON "ExperienceRecord"("projectId", "reference");

-- CreateIndex
CREATE INDEX "ExperienceAllocation_movementId_idx" ON "ExperienceAllocation"("movementId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperienceAllocation_recordId_movementId_key" ON "ExperienceAllocation"("recordId", "movementId");

-- CreateIndex
CREATE INDEX "ExperienceEvent_recordId_createdAt_idx" ON "ExperienceEvent"("recordId", "createdAt");

-- AddForeignKey
ALTER TABLE "ExperienceRecord" ADD CONSTRAINT "ExperienceRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceRecord" ADD CONSTRAINT "ExperienceRecord_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceRecord" ADD CONSTRAINT "ExperienceRecord_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ExperienceFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceAllocation" ADD CONSTRAINT "ExperienceAllocation_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ExperienceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceAllocation" ADD CONSTRAINT "ExperienceAllocation_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceEvent" ADD CONSTRAINT "ExperienceEvent_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ExperienceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

