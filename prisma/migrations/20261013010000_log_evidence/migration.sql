ALTER TABLE "SiteLog" ADD COLUMN "front" TEXT NOT NULL DEFAULT '', ADD COLUMN "budgetItemId" TEXT;
ALTER TABLE "SiteLog" ADD CONSTRAINT "SiteLog_budgetItemId_fkey" FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TABLE "LogAddendum" (
 "id" TEXT NOT NULL PRIMARY KEY, "logId" TEXT NOT NULL REFERENCES "SiteLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "text" TEXT NOT NULL, "author" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "sourceAttachmentId" TEXT UNIQUE
);
CREATE INDEX "LogAddendum_logId_createdAt_idx" ON "LogAddendum"("logId","createdAt");
CREATE TABLE "LogAttachment" (
 "id" TEXT NOT NULL PRIMARY KEY, "logId" TEXT NOT NULL REFERENCES "SiteLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "addendumId" TEXT REFERENCES "LogAddendum"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "name" TEXT NOT NULL, "mime" TEXT NOT NULL, "size" INTEGER NOT NULL, "sha256" TEXT NOT NULL, "caption" TEXT NOT NULL,
 "content" BYTEA NOT NULL, "author" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "transcript" TEXT, "transcriptionStatus" TEXT NOT NULL DEFAULT 'NONE', "transcriptionStartedAt" TIMESTAMP(3),
 CONSTRAINT "LogAttachment_size_limit" CHECK ("size">0 AND "size"<=8388608),
 CONSTRAINT "LogAttachment_transcription_status" CHECK ("transcriptionStatus" IN ('NONE','PROCESSING','READY','ERROR')),
 UNIQUE("logId","sha256")
);
ALTER TABLE "LogAddendum" ADD CONSTRAINT "LogAddendum_sourceAttachmentId_fkey" FOREIGN KEY ("sourceAttachmentId") REFERENCES "LogAttachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "LogAttachment_logId_createdAt_idx" ON "LogAttachment"("logId","createdAt");
