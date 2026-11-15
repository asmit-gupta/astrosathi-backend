-- Founder's decision (15 Nov 2026): clear all audit entries; recording is now opt-in per action (AUDIT_ACTIONS).
-- TRUNCATE does not fire the row-level append-only trigger, so that protection stays for future entries.
TRUNCATE TABLE "audit_logs";
