-- CreateEnum
CREATE TYPE "AuthApp" AS ENUM ('user', 'provider');

-- CreateEnum
CREATE TYPE "AstrologerStatus" AS ENUM ('draft', 'submitted', 'needs_changes', 'interview_scheduled', 'approved', 'rejected', 'suspended');

-- CreateEnum
CREATE TYPE "ConsultMode" AS ENUM ('chat', 'voice', 'video');

-- CreateEnum
CREATE TYPE "IdType" AS ENUM ('aadhaar', 'passport', 'driving_licence', 'voter_id');

-- CreateEnum
CREATE TYPE "UploadPurpose" AS ENUM ('photo', 'pan', 'id_front', 'id_back', 'experience_proof', 'intro_video');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('pending', 'uploaded');

-- CreateEnum
CREATE TYPE "DocReview" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "RateStatus" AS ENUM ('requested', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConsentDoc" ADD VALUE 'provider_conduct';
ALTER TYPE "ConsentDoc" ADD VALUE 'provider_terms';

-- AlterTable
ALTER TABLE "auth_sessions" ADD COLUMN     "app" "AuthApp" NOT NULL DEFAULT 'user';

-- CreateTable
CREATE TABLE "method_tags" (
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_hi" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "method_tags_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "astrologers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "AstrologerStatus" NOT NULL DEFAULT 'draft',
    "legal_name" TEXT,
    "display_name" TEXT,
    "gender" "Gender",
    "place_id" INTEGER,
    "languages" TEXT[],
    "experience_years" INTEGER,
    "photo_upload_id" UUID,
    "methods" TEXT[],
    "primary_category" TEXT,
    "secondary_categories" TEXT[],
    "capabilities_requested" TEXT[],
    "bio" TEXT,
    "id_type" "IdType",
    "pan_upload_id" UUID,
    "id_front_upload_id" UUID,
    "id_back_upload_id" UUID,
    "proof_upload_id" UUID,
    "intro_video_upload_id" UUID,
    "capabilities" TEXT[],
    "listed" BOOLEAN NOT NULL DEFAULT false,
    "interview_at" TIMESTAMP(3),
    "interview_link" TEXT,
    "reject_reason" TEXT,
    "reapply_after" TIMESTAMP(3),
    "suspend_reason" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astrologers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "astrologer_kyc" (
    "astrologer_id" UUID NOT NULL,
    "pan_enc" TEXT NOT NULL,
    "pan_last4" TEXT NOT NULL,
    "bank_account_enc" TEXT NOT NULL,
    "bank_account_last4" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "account_holder" TEXT,
    "gstin" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astrologer_kyc_pkey" PRIMARY KEY ("astrologer_id")
);

-- CreateTable
CREATE TABLE "astrologer_rates" (
    "id" UUID NOT NULL,
    "astrologer_id" UUID NOT NULL,
    "mode" "ConsultMode" NOT NULL,
    "rate_paise" INTEGER NOT NULL,
    "status" "RateStatus" NOT NULL,
    "effective_from" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "astrologer_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "astrologer_events" (
    "id" UUID NOT NULL,
    "astrologer_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT,
    "actor" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astrologer_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_fixes" (
    "id" UUID NOT NULL,
    "astrologer_id" UUID NOT NULL,
    "field" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "application_fixes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profile_revisions" (
    "id" UUID NOT NULL,
    "astrologer_id" UUID NOT NULL,
    "changes" JSONB NOT NULL,
    "status" "RevisionStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "profile_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "astrologer_availability" (
    "astrologer_id" UUID NOT NULL,
    "chat" BOOLEAN NOT NULL DEFAULT false,
    "voice" BOOLEAN NOT NULL DEFAULT false,
    "video" BOOLEAN NOT NULL DEFAULT false,
    "away_until" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "astrologer_availability_pkey" PRIMARY KEY ("astrologer_id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "purpose" "UploadPurpose" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'pending',
    "review" "DocReview" NOT NULL DEFAULT 'pending',
    "review_note" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "uploaded_at" TIMESTAMP(3),

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "astrologers_user_id_key" ON "astrologers"("user_id");

-- CreateIndex
CREATE INDEX "astrologers_status_submitted_at_idx" ON "astrologers"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "astrologers_listed_primary_category_idx" ON "astrologers"("listed", "primary_category");

-- CreateIndex
CREATE INDEX "astrologer_rates_astrologer_id_mode_status_idx" ON "astrologer_rates"("astrologer_id", "mode", "status");

-- CreateIndex
CREATE INDEX "astrologer_events_astrologer_id_created_at_idx" ON "astrologer_events"("astrologer_id", "created_at");

-- CreateIndex
CREATE INDEX "application_fixes_astrologer_id_resolved_at_idx" ON "application_fixes"("astrologer_id", "resolved_at");

-- CreateIndex
CREATE INDEX "profile_revisions_status_created_at_idx" ON "profile_revisions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uploads_storage_key_key" ON "uploads"("storage_key");

-- CreateIndex
CREATE INDEX "uploads_owner_user_id_purpose_idx" ON "uploads"("owner_user_id", "purpose");

-- AddForeignKey
ALTER TABLE "astrologers" ADD CONSTRAINT "astrologers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologers" ADD CONSTRAINT "astrologers_place_id_fkey" FOREIGN KEY ("place_id") REFERENCES "places"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_kyc" ADD CONSTRAINT "astrologer_kyc_astrologer_id_fkey" FOREIGN KEY ("astrologer_id") REFERENCES "astrologers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_rates" ADD CONSTRAINT "astrologer_rates_astrologer_id_fkey" FOREIGN KEY ("astrologer_id") REFERENCES "astrologers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_events" ADD CONSTRAINT "astrologer_events_astrologer_id_fkey" FOREIGN KEY ("astrologer_id") REFERENCES "astrologers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_fixes" ADD CONSTRAINT "application_fixes_astrologer_id_fkey" FOREIGN KEY ("astrologer_id") REFERENCES "astrologers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profile_revisions" ADD CONSTRAINT "profile_revisions_astrologer_id_fkey" FOREIGN KEY ("astrologer_id") REFERENCES "astrologers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "astrologer_availability" ADD CONSTRAINT "astrologer_availability_astrologer_id_fkey" FOREIGN KEY ("astrologer_id") REFERENCES "astrologers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

