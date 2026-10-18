CREATE TABLE "Drawing" (
 "id" TEXT PRIMARY KEY, "projectId" TEXT NOT NULL REFERENCES "Project"("id") ON UPDATE CASCADE,
 "code" TEXT NOT NULL, "name" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Drawing_projectId_code_key" ON "Drawing"("projectId","code");
CREATE TABLE "DrawingVersion" (
 "id" TEXT PRIMARY KEY, "drawingId" TEXT NOT NULL REFERENCES "Drawing"("id") ON UPDATE CASCADE,
 "number" INTEGER NOT NULL CHECK ("number">0), "label" TEXT NOT NULL, "note" TEXT NOT NULL,
 "name" TEXT NOT NULL, "size" INTEGER NOT NULL CHECK ("size" BETWEEN 1 AND 15728640),
 "sha256" TEXT NOT NULL, "pageCount" INTEGER NOT NULL CHECK ("pageCount" BETWEEN 1 AND 20),
 "content" BYTEA NOT NULL, "author" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "DrawingVersion_drawingId_number_key" ON "DrawingVersion"("drawingId","number");
CREATE UNIQUE INDEX "DrawingVersion_drawingId_sha256_key" ON "DrawingVersion"("drawingId","sha256");
CREATE TABLE "PlanIssue" (
 "id" TEXT PRIMARY KEY, "number" SERIAL NOT NULL,
 "versionId" TEXT NOT NULL REFERENCES "DrawingVersion"("id") ON UPDATE CASCADE,
 "page" INTEGER NOT NULL CHECK ("page">0), "x" DOUBLE PRECISION NOT NULL CHECK ("x" BETWEEN 0 AND 1),
 "y" DOUBLE PRECISION NOT NULL CHECK ("y" BETWEEN 0 AND 1),
 "title" TEXT NOT NULL, "description" TEXT NOT NULL, "assignee" TEXT NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL,
 "priority" TEXT NOT NULL CHECK ("priority" IN ('LOW','NORMAL','HIGH')),
 "status" TEXT NOT NULL DEFAULT 'OPEN' CHECK ("status" IN ('OPEN','IN_PROGRESS','RESOLVED')),
 "revision" INTEGER NOT NULL DEFAULT 0, "author" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PlanIssue_number_key" ON "PlanIssue"("number");
CREATE INDEX "PlanIssue_versionId_status_idx" ON "PlanIssue"("versionId","status");
CREATE TABLE "IssueEvent" (
 "id" TEXT PRIMARY KEY, "issueId" TEXT NOT NULL REFERENCES "PlanIssue"("id") ON UPDATE CASCADE,
 "action" TEXT NOT NULL CHECK ("action" IN ('CREATED','COMMENT','START','RESOLVE','REOPEN','ASSIGN')),
 "note" TEXT NOT NULL, "author" TEXT NOT NULL, "assignee" TEXT NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "IssueEvent_issueId_createdAt_idx" ON "IssueEvent"("issueId","createdAt");
CREATE TABLE "IssueEvidence" (
 "id" TEXT PRIMARY KEY, "eventId" TEXT NOT NULL REFERENCES "IssueEvent"("id") ON UPDATE CASCADE,
 "name" TEXT NOT NULL, "mime" TEXT NOT NULL, "size" INTEGER NOT NULL CHECK ("size" BETWEEN 1 AND 8388608),
 "sha256" TEXT NOT NULL, "content" BYTEA NOT NULL
);
CREATE UNIQUE INDEX "IssueEvidence_eventId_sha256_key" ON "IssueEvidence"("eventId","sha256");
