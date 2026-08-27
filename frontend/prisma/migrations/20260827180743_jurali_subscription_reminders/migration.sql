-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "reminderStage" TEXT,
ADD COLUMN     "reminderStageRenewsAt" TIMESTAMP(3);
