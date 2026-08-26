-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT,
ADD COLUMN     "overdueAlertsEnabled" BOOLEAN NOT NULL DEFAULT false;
