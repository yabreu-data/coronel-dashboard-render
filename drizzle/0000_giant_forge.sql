CREATE TABLE "admin_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity" varchar(80) NOT NULL,
	"action" varchar(80) NOT NULL,
	"entityId" varchar(120),
	"details" text,
	"changedBy" varchar(160) NOT NULL,
	"changedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "birthday_campaigns" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientKey" varchar(160) NOT NULL,
	"clientName" varchar(160) NOT NULL,
	"phone" varchar(40),
	"stage" text DEFAULT 'week' NOT NULL,
	"channel" text DEFAULT 'llamada' NOT NULL,
	"updatedBy" varchar(160),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "birthday_campaigns_clientKey_unique" UNIQUE("clientKey")
);
--> statement-breakpoint
CREATE TABLE "call_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"clientKey" varchar(160) NOT NULL,
	"clientName" varchar(160) NOT NULL,
	"phone" varchar(40),
	"callDate" timestamp DEFAULT now() NOT NULL,
	"outcome" varchar(80) NOT NULL,
	"promotion" varchar(180),
	"promotionRedeemed" integer DEFAULT 0 NOT NULL,
	"nextCallDate" timestamp,
	"recoveryResult" varchar(120),
	"notes" text,
	"createdBy" varchar(160),
	"assignedTo" varchar(160),
	"campaignStage" text,
	"campaignChannel" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "priority_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"priorityKey" varchar(220) NOT NULL,
	"status" text NOT NULL,
	"responsible" varchar(160),
	"dueDate" timestamp,
	"changedBy" varchar(160),
	"changedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "priority_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"priorityKey" varchar(220) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"responsible" varchar(160),
	"dueDate" timestamp,
	"updatedBy" varchar(160),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "priority_items_priorityKey_unique" UNIQUE("priorityKey")
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(180) NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "responsible_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(320),
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"action" text NOT NULL,
	"ipAddress" varchar(80),
	"userAgent" varchar(500),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_target_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"surveysPerServer" integer NOT NULL,
	"surveysPerDelivery" integer DEFAULT 10 NOT NULL,
	"positiveQualityPercent" integer NOT NULL,
	"periodLabel" varchar(120) NOT NULL,
	"changedBy" varchar(160),
	"changedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_targets" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"surveysPerServer" integer DEFAULT 10 NOT NULL,
	"surveysPerDelivery" integer DEFAULT 10 NOT NULL,
	"positiveQualityPercent" integer DEFAULT 80 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" text DEFAULT 'user' NOT NULL,
	"canViewCustomers" integer DEFAULT 0 NOT NULL,
	"canManageCalls" integer DEFAULT 0 NOT NULL,
	"canManageTargets" integer DEFAULT 0 NOT NULL,
	"canManageUsers" integer DEFAULT 0 NOT NULL,
	"canViewAudit" integer DEFAULT 0 NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"avatarPreset" varchar(40) DEFAULT 'coronel',
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
