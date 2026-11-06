ALTER TABLE "birthday_campaigns" ADD COLUMN "progressStatus" text DEFAULT 'pending' NOT NULL;
--> statement-breakpoint
UPDATE "birthday_campaigns" AS c SET "progressStatus" = CASE
  WHEN EXISTS (SELECT 1 FROM "call_logs" l WHERE l."clientKey" = c."clientKey" AND l."promotionRedeemed" = 1) THEN 'redeemed'
  WHEN EXISTS (SELECT 1 FROM "call_logs" l WHERE l."clientKey" = c."clientKey" AND (l."outcome" ILIKE '%acept%' OR l."recoveryResult" ILIKE '%acept%')) THEN 'accepted'
  WHEN EXISTS (SELECT 1 FROM "call_logs" l WHERE l."clientKey" = c."clientKey" AND (l."outcome" = 'Contactado' OR l."recoveryResult" ILIKE '%cumple%')) THEN 'contacted'
  WHEN EXISTS (SELECT 1 FROM "call_logs" l WHERE l."clientKey" = c."clientKey" AND l."outcome" ILIKE '%no contest%') THEN 'noanswer'
  ELSE c."progressStatus"
END;
