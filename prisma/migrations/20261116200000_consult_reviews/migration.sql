-- AlterTable
ALTER TABLE "astrologers" ADD COLUMN     "rating_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rating_sum" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "consult_reviews" (
    "id" UUID NOT NULL,
    "consult_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "astrologer_id" UUID NOT NULL,
    "stars" INTEGER NOT NULL,
    "text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consult_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consult_reviews_consult_id_key" ON "consult_reviews"("consult_id");

-- CreateIndex
CREATE INDEX "consult_reviews_astrologer_id_created_at_idx" ON "consult_reviews"("astrologer_id", "created_at");

-- AddForeignKey
ALTER TABLE "consult_reviews" ADD CONSTRAINT "consult_reviews_consult_id_fkey" FOREIGN KEY ("consult_id") REFERENCES "consults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consult_reviews" ADD CONSTRAINT "consult_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consult_reviews" ADD CONSTRAINT "consult_reviews_astrologer_id_fkey" FOREIGN KEY ("astrologer_id") REFERENCES "astrologers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

