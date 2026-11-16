-- CreateEnum
CREATE TYPE "LedgerAccount" AS ENUM ('wallet', 'earnings', 'platform', 'adjustment');

-- CreateEnum
CREATE TYPE "LedgerKind" AS ENUM ('admin_credit', 'consult_minute');

-- CreateEnum
CREATE TYPE "ConsultStatus" AS ENUM ('requested', 'active', 'ended', 'declined', 'missed', 'cancelled');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('user', 'provider', 'system');

-- CreateTable
CREATE TABLE "wallets" (
    "user_id" UUID NOT NULL,
    "balance_paise" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "txn_id" UUID NOT NULL,
    "account" "LedgerAccount" NOT NULL,
    "owner_id" UUID,
    "amount_paise" INTEGER NOT NULL,
    "kind" "LedgerKind" NOT NULL,
    "consult_id" UUID,
    "minute" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consults" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "astrologer_id" UUID NOT NULL,
    "mode" "ConsultMode" NOT NULL,
    "status" "ConsultStatus" NOT NULL,
    "rate_paise" INTEGER NOT NULL,
    "platform_share_pct" INTEGER NOT NULL,
    "birth" JSONB,
    "requested_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "end_reason" TEXT,
    "minutes_billed" INTEGER NOT NULL DEFAULT 0,
    "charged_paise" INTEGER NOT NULL DEFAULT 0,
    "next_charge_at" TIMESTAMP(3),
    "user_seen_at" TIMESTAMP(3),
    "astrologer_seen_at" TIMESTAMP(3),
    "last_seq" INTEGER NOT NULL DEFAULT 0,
    "user_read_seq" INTEGER NOT NULL DEFAULT 0,
    "astrologer_read_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "consults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consult_messages" (
    "id" UUID NOT NULL,
    "consult_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "body" TEXT NOT NULL,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consult_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_entries_account_owner_id_created_at_idx" ON "ledger_entries"("account", "owner_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_consult_id_minute_account_key" ON "ledger_entries"("consult_id", "minute", "account");

-- CreateIndex
CREATE INDEX "consults_user_id_status_idx" ON "consults"("user_id", "status");

-- CreateIndex
CREATE INDEX "consults_astrologer_id_status_idx" ON "consults"("astrologer_id", "status");

-- CreateIndex
CREATE INDEX "consults_status_next_charge_at_idx" ON "consults"("status", "next_charge_at");

-- CreateIndex
CREATE UNIQUE INDEX "consult_messages_consult_id_seq_key" ON "consult_messages"("consult_id", "seq");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consults" ADD CONSTRAINT "consults_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consults" ADD CONSTRAINT "consults_astrologer_id_fkey" FOREIGN KEY ("astrologer_id") REFERENCES "astrologers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consult_messages" ADD CONSTRAINT "consult_messages_consult_id_fkey" FOREIGN KEY ("consult_id") REFERENCES "consults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

