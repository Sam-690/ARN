CREATE TABLE "ChangeRequest" (
 "id" TEXT PRIMARY KEY, "number" SERIAL NOT NULL,
 "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON UPDATE CASCADE,
 "title" TEXT NOT NULL, "reason" TEXT NOT NULL, "author" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED')),
 "revision" INTEGER NOT NULL DEFAULT 0, "progress" INTEGER NOT NULL DEFAULT 0 CHECK ("progress" BETWEEN 0 AND 100),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ChangeRequest_number_key" ON "ChangeRequest"("number");
CREATE TABLE "ChangeProposal" (
 "id" TEXT PRIMARY KEY, "changeId" TEXT NOT NULL REFERENCES "ChangeRequest"("id") ON UPDATE CASCADE,
 "number" INTEGER NOT NULL CHECK ("number">0), "scope" TEXT NOT NULL,
 "costDelta" DECIMAL(18,2) NOT NULL, "priceDelta" DECIMAL(18,2) NOT NULL, "daysDelta" INTEGER NOT NULL,
 "author" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ChangeProposal_changeId_number_key" ON "ChangeProposal"("changeId","number");
CREATE TABLE "ChangeEvent" (
 "id" TEXT PRIMARY KEY, "changeId" TEXT NOT NULL REFERENCES "ChangeRequest"("id") ON UPDATE CASCADE,
 "action" TEXT NOT NULL CHECK ("action" IN ('CREATED','REVISE','SUBMIT','APPROVE','REJECT','CANCEL','PROGRESS','SETTLEMENT')),
 "note" TEXT NOT NULL, "actor" TEXT NOT NULL, "proposalNumber" INTEGER NOT NULL, "progress" INTEGER,
 "authorizationBy" TEXT, "authorizationReference" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ChangeEvent_changeId_createdAt_idx" ON "ChangeEvent"("changeId","createdAt");
CREATE TABLE "ChangeSettlement" (
 "id" TEXT PRIMARY KEY, "changeId" TEXT NOT NULL REFERENCES "ChangeRequest"("id") ON UPDATE CASCADE,
 "amount" DECIMAL(18,2) NOT NULL CHECK ("amount">0), "reference" TEXT NOT NULL, "date" TIMESTAMP(3) NOT NULL,
 "note" TEXT NOT NULL, "actor" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ChangeSettlement_changeId_reference_key" ON "ChangeSettlement"("changeId","reference");
