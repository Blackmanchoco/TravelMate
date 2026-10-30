-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('PLACE_ARCHIVED', 'ITINERARY_DELETED');

-- AlterTable
ALTER TABLE "places" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" SERIAL NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetLabel" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_logs_adminUserId_idx" ON "admin_audit_logs"("adminUserId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");

-- CreateIndex
CREATE INDEX "admin_audit_logs_targetType_targetId_idx" ON "admin_audit_logs"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "places_deletedAt_idx" ON "places"("deletedAt");

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
