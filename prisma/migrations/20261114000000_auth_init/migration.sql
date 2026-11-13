-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'deletion_pending', 'deleted');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('hi', 'en');

-- CreateEnum
CREATE TYPE "ConsentDoc" AS ENUM ('terms', 'privacy', 'age_18', 'marketing');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('login');

-- CreateEnum
CREATE TYPE "OtpDelivery" AS ENUM ('pending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "phone_hash" TEXT NOT NULL,
    "phone_enc" TEXT NOT NULL,
    "phone_last4" CHAR(4) NOT NULL,
    "name" TEXT,
    "language" "Language" NOT NULL DEFAULT 'hi',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "roles" TEXT[] DEFAULT ARRAY['user']::TEXT[],
    "age_declared_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "doc_type" "ConsentDoc" NOT NULL,
    "doc_version" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "ip" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL,
    "withdrawn_at" TIMESTAMP(3),

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_requests" (
    "id" UUID NOT NULL,
    "phone_hash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL DEFAULT 'login',
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMP(3),
    "locked_until" TIMESTAMP(3),
    "ip" TEXT,
    "device_id" TEXT,
    "delivery" "OtpDelivery" NOT NULL DEFAULT 'pending',
    "provider_ref" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otp_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "platform" TEXT,
    "app_version" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoke_reason" TEXT,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_hash_key" ON "users"("phone_hash");

-- CreateIndex
CREATE INDEX "consents_user_id_doc_type_idx" ON "consents"("user_id", "doc_type");

-- CreateIndex
CREATE INDEX "otp_requests_phone_hash_created_at_idx" ON "otp_requests"("phone_hash", "created_at");

-- CreateIndex
CREATE INDEX "otp_requests_ip_created_at_idx" ON "otp_requests"("ip", "created_at");

-- CreateIndex
CREATE INDEX "otp_requests_device_id_created_at_idx" ON "otp_requests"("device_id", "created_at");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

