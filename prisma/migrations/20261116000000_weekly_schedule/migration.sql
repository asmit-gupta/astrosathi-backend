-- AlterTable
ALTER TABLE "astrologer_availability" ADD COLUMN     "schedule_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "schedule_modes" TEXT[],
ADD COLUMN     "schedule_skip_until" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "astrologer_schedule_slots" (
    "id" UUID NOT NULL,
    "astrologer_id" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,

    CONSTRAINT "astrologer_schedule_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "astrologer_schedule_slots_astrologer_id_weekday_idx" ON "astrologer_schedule_slots"("astrologer_id", "weekday");

-- AddForeignKey
ALTER TABLE "astrologer_schedule_slots" ADD CONSTRAINT "astrologer_schedule_slots_astrologer_id_fkey" FOREIGN KEY ("astrologer_id") REFERENCES "astrologers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

