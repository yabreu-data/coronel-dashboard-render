CREATE TABLE "message_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(60) NOT NULL,
	"name" varchar(120) NOT NULL,
	"body" text NOT NULL,
	"updatedBy" varchar(160),
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "message_templates_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "birthday_campaigns" ADD COLUMN "promotion" varchar(180);--> statement-breakpoint
ALTER TABLE "birthday_campaigns" ADD COLUMN "responsible" varchar(160);--> statement-breakpoint
ALTER TABLE "birthday_campaigns" ADD COLUMN "nextActionAt" timestamp;--> statement-breakpoint
ALTER TABLE "birthday_campaigns" ADD COLUMN "nextActionLabel" varchar(120);--> statement-breakpoint
ALTER TABLE "birthday_campaigns" ADD COLUMN "familyName" varchar(160);--> statement-breakpoint
ALTER TABLE "birthday_campaigns" ADD COLUMN "familyBirthday" varchar(20);--> statement-breakpoint
ALTER TABLE "birthday_campaigns" ADD COLUMN "noRedeemReason" varchar(200);--> statement-breakpoint
ALTER TABLE "birthday_campaigns" ADD COLUMN "notes" text;