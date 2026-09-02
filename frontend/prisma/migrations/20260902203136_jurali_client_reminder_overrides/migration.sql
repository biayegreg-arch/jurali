-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "autoReminderEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "autoReminderThresholdDays" INTEGER,
ADD COLUMN     "overdueAlertThresholdDays" INTEGER;
