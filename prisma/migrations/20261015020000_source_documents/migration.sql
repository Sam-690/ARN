CREATE TABLE "SourceDocument" (
 "id" TEXT NOT NULL PRIMARY KEY, "number" SERIAL NOT NULL, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "name" TEXT NOT NULL, "mime" TEXT NOT NULL, "size" INTEGER NOT NULL, "sha256" TEXT NOT NULL, "content" BYTEA NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'DRAFT', "revision" INTEGER NOT NULL DEFAULT 0,
 "extractionStatus" TEXT NOT NULL DEFAULT 'NONE', "extractionStartedAt" TIMESTAMP(3), "extracted" JSONB, "reviewed" JSONB,
 "identityKey" TEXT, "orderId" TEXT, "author" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "SourceDocument_number_key" ON "SourceDocument"("number");
CREATE UNIQUE INDEX "SourceDocument_sha256_key" ON "SourceDocument"("sha256");
CREATE UNIQUE INDEX "SourceDocument_identityKey_key" ON "SourceDocument"("identityKey");
CREATE INDEX "SourceDocument_projectId_createdAt_idx" ON "SourceDocument"("projectId", "createdAt");
CREATE TABLE "DocumentEvent" (
 "id" TEXT NOT NULL PRIMARY KEY, "documentId" TEXT NOT NULL REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "action" TEXT NOT NULL, "note" TEXT NOT NULL, "actor" TEXT NOT NULL, "snapshot" JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "DocumentEvent_documentId_createdAt_idx" ON "DocumentEvent"("documentId", "createdAt");
