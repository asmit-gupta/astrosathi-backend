-- CreateTable
CREATE TABLE "admins" (
    "id" UUID NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "totp_secret_enc" TEXT NOT NULL,
    "last_totp_step" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "password_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3) NOT NULL,
    "step_up_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_login_attempts" (
    "id" UUID NOT NULL,
    "ip" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "value" JSONB NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_singleton_key" ON "admins"("singleton");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_id_revoked_at_idx" ON "admin_sessions"("admin_id", "revoked_at");

-- CreateIndex
CREATE INDEX "admin_login_attempts_ip_created_at_idx" ON "admin_login_attempts"("ip", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "settings_key_effective_from_idx" ON "settings"("key", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_version_key" ON "settings"("key", "version");

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Audit log is append-only (handoff §4A: "cannot be edited or deleted by anyone").
CREATE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

-- Exactly one admin: the singleton column must be true (unique index allows one row).
ALTER TABLE "admins" ADD CONSTRAINT "admins_singleton_true" CHECK ("singleton" = true);
