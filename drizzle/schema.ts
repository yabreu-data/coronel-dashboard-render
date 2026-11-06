import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Esquema PostgreSQL (Supabase).
 *
 * Las columnas mantienen los nombres camelCase originales para no romper las
 * consultas, los tipos compartidos ni el contrato tRPC. Los antiguos ENUM de
 * MySQL se modelan como `text` con unión de valores en TypeScript: PostgreSQL
 * los almacena como texto y Zod valida la entrada en los routers.
 */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  /** Identificador del usuario en Supabase Auth (uuid). */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  canViewCustomers: integer("canViewCustomers").default(0).notNull(),
  canManageCalls: integer("canManageCalls").default(0).notNull(),
  canManageTargets: integer("canManageTargets").default(0).notNull(),
  canManageUsers: integer("canManageUsers").default(0).notNull(),
  canViewAudit: integer("canViewAudit").default(0).notNull(),
  active: integer("active").default(1).notNull(),
  avatarPreset: varchar("avatarPreset", { length: 40 }).default("coronel"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const sessionHistory = pgTable("session_history", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull(),
  action: text("action", { enum: ["login", "logout"] }).notNull(),
  ipAddress: varchar("ipAddress", { length: 80 }),
  userAgent: varchar("userAgent", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SessionHistory = typeof sessionHistory.$inferSelect;

export const callLogs = pgTable("call_logs", {
  id: serial("id").primaryKey(),
  clientKey: varchar("clientKey", { length: 160 }).notNull(),
  clientName: varchar("clientName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  callDate: timestamp("callDate").defaultNow().notNull(),
  outcome: varchar("outcome", { length: 80 }).notNull(),
  promotion: varchar("promotion", { length: 180 }),
  promotionRedeemed: integer("promotionRedeemed").default(0).notNull(),
  nextCallDate: timestamp("nextCallDate"),
  recoveryResult: varchar("recoveryResult", { length: 120 }),
  notes: text("notes"),
  createdBy: varchar("createdBy", { length: 160 }),
  assignedTo: varchar("assignedTo", { length: 160 }),
  campaignStage: text("campaignStage", { enum: ["week", "soon", "tomorrow", "today", "past"] }),
  campaignChannel: text("campaignChannel", { enum: ["llamada", "whatsapp", "correo", "sms"] }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CallLog = typeof callLogs.$inferSelect;
export type InsertCallLog = typeof callLogs.$inferInsert;

export const birthdayCampaigns = pgTable("birthday_campaigns", {
  id: serial("id").primaryKey(),
  clientKey: varchar("clientKey", { length: 160 }).notNull().unique(),
  clientName: varchar("clientName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  stage: text("stage", { enum: ["week", "soon", "tomorrow", "today", "past"] }).notNull().default("week"),
  channel: text("channel", { enum: ["llamada", "whatsapp", "correo", "sms"] }).notNull().default("llamada"),
  progressStatus: text("progressStatus", { enum: ["pending", "contacted", "accepted", "redeemed", "rejected", "noanswer"] }).notNull().default("pending"),
  promotion: varchar("promotion", { length: 180 }),
  responsible: varchar("responsible", { length: 160 }),
  nextActionAt: timestamp("nextActionAt"),
  nextActionLabel: varchar("nextActionLabel", { length: 120 }),
  familyName: varchar("familyName", { length: 160 }),
  familyBirthday: varchar("familyBirthday", { length: 20 }),
  noRedeemReason: varchar("noRedeemReason", { length: 200 }),
  notes: text("notes"),
  updatedBy: varchar("updatedBy", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
export type BirthdayCampaign = typeof birthdayCampaigns.$inferSelect;

/** Plantillas de mensajes editables (WhatsApp / correo) por etapa del protocolo. */
export const messageTemplates = pgTable("message_templates", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 60 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  body: text("body").notNull(),
  updatedBy: varchar("updatedBy", { length: 160 }),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
export type MessageTemplate = typeof messageTemplates.$inferSelect;
export type InsertMessageTemplate = typeof messageTemplates.$inferInsert;
export type InsertBirthdayCampaign = typeof birthdayCampaigns.$inferInsert;

export const teamTargets = pgTable("team_targets", {
  id: integer("id").primaryKey().default(1),
  surveysPerServer: integer("surveysPerServer").notNull().default(10),
  surveysPerDelivery: integer("surveysPerDelivery").notNull().default(10),
  positiveQualityPercent: integer("positiveQualityPercent").notNull().default(80),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type TeamTargets = typeof teamTargets.$inferSelect;
export type InsertTeamTargets = typeof teamTargets.$inferInsert;

export const priorityItems = pgTable("priority_items", {
  id: serial("id").primaryKey(),
  priorityKey: varchar("priorityKey", { length: 220 }).notNull().unique(),
  status: text("status", { enum: ["pending", "in_progress", "done"] }).default("pending").notNull(),
  responsible: varchar("responsible", { length: 160 }),
  dueDate: timestamp("dueDate"),
  updatedBy: varchar("updatedBy", { length: 160 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export type PriorityItem = typeof priorityItems.$inferSelect;
export type InsertPriorityItem = typeof priorityItems.$inferInsert;

export const priorityHistory = pgTable("priority_history", {
  id: serial("id").primaryKey(),
  priorityKey: varchar("priorityKey", { length: 220 }).notNull(),
  status: text("status", { enum: ["pending", "in_progress", "done"] }).notNull(),
  responsible: varchar("responsible", { length: 160 }),
  dueDate: timestamp("dueDate"),
  changedBy: varchar("changedBy", { length: 160 }),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
});

export type PriorityHistory = typeof priorityHistory.$inferSelect;

export const promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull().unique(),
  category: text("category", { enum: ["recuperacion", "cumpleanos", "fidelidad", "general"] }).default("general").notNull(),
  active: integer("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = typeof promotions.$inferInsert;

export const responsibleUsers = pgTable("responsible_users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }),
  active: integer("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ResponsibleUser = typeof responsibleUsers.$inferSelect;
export type InsertResponsibleUser = typeof responsibleUsers.$inferInsert;

export const teamTargetHistory = pgTable("team_target_history", {
  id: serial("id").primaryKey(),
  surveysPerServer: integer("surveysPerServer").notNull(),
  surveysPerDelivery: integer("surveysPerDelivery").notNull().default(10),
  positiveQualityPercent: integer("positiveQualityPercent").notNull(),
  periodLabel: varchar("periodLabel", { length: 120 }).notNull(),
  changedBy: varchar("changedBy", { length: 160 }),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
});
export type TeamTargetHistory = typeof teamTargetHistory.$inferSelect;

export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  entity: varchar("entity", { length: 80 }).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 120 }),
  details: text("details"),
  changedBy: varchar("changedBy", { length: 160 }).notNull(),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
});
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;

/**
 * Solicitudes de acceso al dashboard. Un usuario nuevo completa el formulario
 * público; un administrador debe aprobarlo para que se cree su cuenta en
 * Supabase Auth y pueda iniciar sesión.
 */
export const accessRequests = pgTable("access_requests", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  message: text("message"),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).default("pending").notNull(),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: varchar("reviewedBy", { length: 160 }),
});

export type AccessRequest = typeof accessRequests.$inferSelect;
export type InsertAccessRequest = typeof accessRequests.$inferInsert;

