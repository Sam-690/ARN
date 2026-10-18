ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'VIEWER', ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true, ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
-- Existing pilot accounts retain their administrative access. New accounts default to least privilege.
UPDATE "User" SET "role"='ADMIN', "mustChangePassword"=false;
CREATE TABLE "ProjectMember" ("userId" TEXT NOT NULL, "projectId" TEXT NOT NULL, CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("userId","projectId"));
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_role_check" CHECK ("role" IN ('ADMIN','MANAGER','PURCHASING','WAREHOUSE','RESIDENT','FINANCE','VIEWER'));
