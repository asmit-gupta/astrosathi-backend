-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('female', 'male', 'other', 'undisclosed');

-- CreateEnum
CREATE TYPE "BirthTimeAccuracy" AS ENUM ('exact', 'morning', 'afternoon', 'evening', 'night', 'unknown');

-- CreateEnum
CREATE TYPE "BudgetBand" AS ENUM ('under_20', 'from_20_to_50', 'from_50_to_100', 'above_100', 'no_preference');

-- CreateEnum
CREATE TYPE "GenderPreference" AS ENUM ('woman', 'man', 'no_preference');

-- CreateEnum
CREATE TYPE "ConsultExperience" AS ENUM ('many', 'few', 'never');

-- CreateEnum
CREATE TYPE "DataRequestType" AS ENUM ('export', 'erasure');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('received', 'in_progress', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_hi" TEXT NOT NULL,
    "description_en" TEXT,
    "description_hi" TEXT,
    "sort_order" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "places" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "ascii_name" TEXT NOT NULL,
    "alias_hi" TEXT,
    "state" TEXT NOT NULL,
    "search_name" TEXT NOT NULL,
    "lat" DECIMAL(8,5) NOT NULL,
    "lng" DECIMAL(8,5) NOT NULL,
    "tz_id" TEXT NOT NULL,
    "population" INTEGER NOT NULL,

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "birth_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "is_self" BOOLEAN NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "dob" DATE NOT NULL,
    "tob" TEXT,
    "tob_accuracy" "BirthTimeAccuracy" NOT NULL,
    "place_id" INTEGER,
    "place_text" TEXT NOT NULL,
    "lat" DECIMAL(8,5) NOT NULL,
    "lng" DECIMAL(8,5) NOT NULL,
    "tz_id" TEXT NOT NULL,
    "marital_status" TEXT,
    "occupation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "birth_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" UUID NOT NULL,
    "topics" TEXT[],
    "languages" TEXT[],
    "modes" TEXT[],
    "budget_band" "BudgetBand",
    "gender_pref" "GenderPreference",
    "first_time" "ConsultExperience",
    "show_everyone" BOOLEAN NOT NULL DEFAULT false,
    "answered_at" TIMESTAMP(3),
    "skipped_at" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "consent_version" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "data_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "DataRequestType" NOT NULL,
    "status" "DataRequestStatus" NOT NULL DEFAULT 'received',
    "due_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "data_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "places_search_name_idx" ON "places"("search_name");

-- CreateIndex
CREATE INDEX "birth_profiles_user_id_idx" ON "birth_profiles"("user_id");

-- CreateIndex
CREATE INDEX "data_requests_user_id_type_status_idx" ON "data_requests"("user_id", "type", "status");

-- AddForeignKey
ALTER TABLE "birth_profiles" ADD CONSTRAINT "birth_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

