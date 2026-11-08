import { and, count, desc, eq, gte, like, lte, ne, or } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { AccessRequest, BirthdayCampaign, InsertBirthdayCampaign, InsertCallLog, InsertPriorityItem, InsertPromotion, InsertResponsibleUser, InsertUser, accessRequests, adminAuditLog, birthdayCampaigns, callLogs, messageTemplates, priorityHistory, priorityItems, promotions, responsibleUsers, sessionHistory, teamTargetHistory, teamTargets, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: NodePgDatabase | null = null;
let _pool: Pool | null = null;

const LOCAL_HOST_PATTERN = /(^|@|\/\/)(localhost|127\.0\.0\.1|::1)(:|\/|$)/i;

function isLocalConnection(connectionString: string) {
  return LOCAL_HOST_PATTERN.test(connectionString);
}

/**
 * Supabase (y casi cualquier PostgreSQL gestionado) exige TLS. En conexiones
 * remotas forzamos TLS aceptando el certificado del pooler; en local se
 * mantiene la conexión sin TLS.
 */
function buildPool(connectionString: string) {
  return new Pool({
    connectionString,
    // El pooler de Supabase en modo sesión limita las conexiones del proyecto
    // (15 en el plan free), por eso mantenemos un pool pequeño y con liberación
    // rápida de conexiones inactivas.
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    ...(isLocalConnection(connectionString) ? {} : { ssl: { rejectUnauthorized: false } }),
  });
}

export async function getDb() {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  try {
    _pool = buildPool(connectionString);
    _pool.on("error", error => console.error("[Database] Error inesperado en el pool:", error));
    _db = drizzle(_pool);
    console.log("[Database] Conectado a PostgreSQL", isLocalConnection(connectionString) ? "(local)" : "(gestionado)");
  } catch (error) {
    console.warn("[Database] Failed to connect:", error);
    _db = null;
  }
  return _db;
}

export async function closeDb() {
  if (_pool) {
    await _pool.end().catch(() => undefined);
    _pool = null;
    _db = null;
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.supabaseAdminUserId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function listAccessUsers() { const db = await getDb(); if (!db) return []; return db.select({ id: users.id, openId: users.openId, name: users.name, email: users.email, role: users.role, canViewCustomers: users.canViewCustomers, canManageCalls: users.canManageCalls, canManageTargets: users.canManageTargets, canManageUsers: users.canManageUsers, canViewAudit: users.canViewAudit, active: users.active, avatarPreset: users.avatarPreset, lastSignedIn: users.lastSignedIn }).from(users).orderBy(users.name); }
export async function updateAccessUser(input: { id: number; role: "user" | "admin"; canViewCustomers: number; canManageCalls: number; canManageTargets: number; canManageUsers: number; canViewAudit: number; active: number }) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); await db.update(users).set({ role: input.role, canViewCustomers: input.canViewCustomers, canManageCalls: input.canManageCalls, canManageTargets: input.canManageTargets, canManageUsers: input.canManageUsers, canViewAudit: input.canViewAudit, active: input.active }).where(eq(users.id, input.id)); return listAccessUsers(); }
export async function updateUserName(openId: string, name: string) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.openId, openId)); return getUserByOpenId(openId); }
export async function updateUserAvatar(openId: string, avatarPreset: string) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); await db.update(users).set({ avatarPreset }).where(eq(users.openId, openId)); return getUserByOpenId(openId); }
export async function recordSessionEvent(input: { openId: string; action: "login" | "logout"; ipAddress?: string; userAgent?: string }) { const db = await getDb(); if (!db) return; await db.insert(sessionHistory).values(input); }
export async function listSessionHistory(openId: string) { const db = await getDb(); if (!db) return []; return db.select().from(sessionHistory).where(eq(sessionHistory.openId, openId)).orderBy(desc(sessionHistory.createdAt)).limit(100); }
export async function listAdminSessionHistory(input: { from?: Date; to?: Date; userQuery?: string; limit: number; offset: number }) { const db = await getDb(); if (!db) return { rows: [], total: 0 }; const conditions = []; if (input.from) conditions.push(gte(sessionHistory.createdAt, input.from)); if (input.to) conditions.push(lte(sessionHistory.createdAt, input.to)); if (input.userQuery?.trim()) { const query = `%${input.userQuery.trim()}%`; conditions.push(or(like(users.name, query), like(users.email, query), like(sessionHistory.openId, query))); } const where = conditions.length ? and(...conditions) : undefined; const [rows, totalRows] = await Promise.all([db.select({ id: sessionHistory.id, openId: sessionHistory.openId, action: sessionHistory.action, ipAddress: sessionHistory.ipAddress, userAgent: sessionHistory.userAgent, createdAt: sessionHistory.createdAt, userName: users.name, userEmail: users.email }).from(sessionHistory).leftJoin(users, eq(sessionHistory.openId, users.openId)).where(where).orderBy(desc(sessionHistory.createdAt)).limit(input.limit).offset(input.offset), db.select({ total: count() }).from(sessionHistory).leftJoin(users, eq(sessionHistory.openId, users.openId)).where(where)]); return { rows, total: Number(totalRows[0]?.total ?? 0) }; }
export async function listCallLogs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(callLogs).orderBy(desc(callLogs.callDate)).limit(250);
}
export async function createCallLog(input: InsertCallLog) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  await db.insert(callLogs).values(input);
  const rows = await db.select().from(callLogs).orderBy(desc(callLogs.id)).limit(1);
  return rows[0];
}

export async function updateCallLog(input: {
  id: number;
  outcome: string;
  promotion?: string | null;
  promotionRedeemed: number;
  recoveryResult?: string | null;
  notes?: string | null;
  callDate: Date;
  nextCallDate?: Date | null;
  assignedTo?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  await db
    .update(callLogs)
    .set({
      outcome: input.outcome,
      promotion: input.promotion ?? null,
      promotionRedeemed: input.promotionRedeemed,
      recoveryResult: input.recoveryResult ?? null,
      notes: input.notes ?? null,
      callDate: input.callDate,
      nextCallDate: input.nextCallDate ?? null,
      assignedTo: input.assignedTo ?? null,
    })
    .where(eq(callLogs.id, input.id));
  const rows = await db.select().from(callLogs).where(eq(callLogs.id, input.id)).limit(1);
  return rows[0];
}

export async function deleteCallLog(id: number) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  const rows = await db.select().from(callLogs).where(eq(callLogs.id, id)).limit(1);
  const target = rows[0];
  if (!target) return { success: true as const, clientKey: null as string | null };
  await db.delete(callLogs).where(eq(callLogs.id, id));
  return { success: true as const, clientKey: target.clientKey };
}

/**
 * Sincroniza el estado del cumpleaños con el historial de llamadas.
 * Se usa al editar o eliminar un registro del historial: el estado del
 * cliente vuelve a reflejar el contacto más reciente que quede.
 */
export async function syncBirthdayProgressFromHistory(clientKey: string) {
  const db = await getDb();
  if (!db) return;
  const campaignRows = await db
    .select()
    .from(birthdayCampaigns)
    .where(eq(birthdayCampaigns.clientKey, clientKey))
    .limit(1);
  const campaign = campaignRows[0];
  if (!campaign) return;

  const logs = await db
    .select()
    .from(callLogs)
    .where(eq(callLogs.clientKey, clientKey))
    .orderBy(desc(callLogs.callDate), desc(callLogs.id))
    .limit(50);

  const newest = logs[0];
  let progressStatus: "pending" | "contacted" | "accepted" | "redeemed" | "rejected" | "noanswer" = "pending";
  if (newest) {
    const text = String(newest.outcome || "").toLowerCase();
    if (text.includes("no contest")) progressStatus = "noanswer";
    else if (text.includes("no redim")) progressStatus = "rejected";
    else if (Boolean(newest.promotionRedeemed) || text.includes("redim")) progressStatus = "redeemed";
    else if (text.includes("acept")) progressStatus = "accepted";
    else progressStatus = "contacted";
  }

  const patch: Record<string, unknown> = { progressStatus, updatedAt: new Date() };
  if (progressStatus === "noanswer" && campaign.nextActionLabel !== "Reintentar llamada") {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0);
    patch.nextActionAt = tomorrow;
    patch.nextActionLabel = "Reintentar llamada";
  }
  if (progressStatus !== "noanswer" && campaign.nextActionLabel === "Reintentar llamada") {
    patch.nextActionAt = null;
    patch.nextActionLabel = null;
  }

  await db
    .update(birthdayCampaigns)
    .set(patch as Partial<typeof birthdayCampaigns.$inferInsert>)
    .where(eq(birthdayCampaigns.clientKey, clientKey));
}
export async function listBirthdayCampaigns() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(birthdayCampaigns).orderBy(desc(birthdayCampaigns.updatedAt));
}
export async function saveBirthdayCampaign(input: InsertBirthdayCampaign) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  await db
    .insert(birthdayCampaigns)
    .values(input)
    .onConflictDoUpdate({
      target: birthdayCampaigns.clientKey,
      set: {
        clientName: input.clientName,
        phone: input.phone ?? null,
        stage: input.stage,
        channel: input.channel,
        progressStatus: input.progressStatus ?? "pending",
        promotion: input.promotion ?? null,
        responsible: input.responsible ?? null,
        nextActionAt: input.nextActionAt ?? null,
        nextActionLabel: input.nextActionLabel ?? null,
        familyName: input.familyName ?? null,
        familyBirthday: input.familyBirthday ?? null,
        noRedeemReason: input.noRedeemReason ?? null,
        notes: input.notes ?? null,
        updatedBy: input.updatedBy ?? null,
      },
    });
  const rows = await db.select().from(birthdayCampaigns).where(eq(birthdayCampaigns.clientKey, input.clientKey)).limit(1);
  return rows[0] as BirthdayCampaign | undefined;
}

/* -------------------------------------------------------------------------- */
/*  Plantillas de mensajes por etapa                                          */
/* -------------------------------------------------------------------------- */

export const DEFAULT_MESSAGE_TEMPLATES: { key: string; name: string; body: string }[] = [
  {
    key: "mes",
    name: "Mes · planificación",
    body:
      "Hola {nombre} 👋 En Coronel estamos preparando algo especial por tu cumpleaños del {fecha}. ¿Te gustaría que te reservemos un detalle? Beneficio: {beneficio}.",
  },
  {
    key: "semana",
    name: "Semana · expectativa y reserva",
    body:
      "Hola {nombre}, falta menos de una semana para tu cumpleaños. Tenemos una sorpresa preparada para ti: {beneficio}. ¿Te la reservamos para el salón o para delivery?",
  },
  {
    key: "dia",
    name: "Día · confirmación y activación",
    body:
      "¡Feliz cumpleaños, {nombre}! 🎉 Hoy te espera tu {beneficio} en Coronel. ¿Te reservamos mesa para celebrar? También podemos enviarlo a tu casa.",
  },
  {
    key: "seguimiento",
    name: "Seguimiento · agradecimiento",
    body:
      "Gracias por celebrar con nosotros, {nombre} 🎂 ¿Nos cuentas cómo fue tu experiencia? Nos ayuda a atenderte mejor la próxima vez. Tu beneficio fue: {beneficio}.",
  },
];

export async function listMessageTemplates() {
  const db = await getDb();
  if (!db) return [];
  const existing = await db.select().from(messageTemplates).orderBy(messageTemplates.key);
  if (existing.length >= DEFAULT_MESSAGE_TEMPLATES.length) return existing;
  const present = new Set(existing.map(item => item.key));
  const missing = DEFAULT_MESSAGE_TEMPLATES.filter(item => !present.has(item.key));
  if (missing.length) {
    await db.insert(messageTemplates).values(missing).onConflictDoNothing();
    return db.select().from(messageTemplates).orderBy(messageTemplates.key);
  }
  return existing;
}

export async function saveMessageTemplate(key: string, body: string, updatedBy: string) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  const fallback = DEFAULT_MESSAGE_TEMPLATES.find(item => item.key === key);
  await db
    .insert(messageTemplates)
    .values({ key, name: fallback?.name ?? key, body, updatedBy })
    .onConflictDoUpdate({ target: messageTemplates.key, set: { body, updatedBy } });
  return listMessageTemplates();
}
export async function getTeamTargets() {
  const db = await getDb();
  if (!db) return { surveysPerServer: 10, surveysPerDelivery: 10, positiveQualityPercent: 80 };
  const rows = await db.select().from(teamTargets).where(eq(teamTargets.id, 1)).limit(1);
  return rows[0] ?? { surveysPerServer: 10, surveysPerDelivery: 10, positiveQualityPercent: 80 };
}

export async function saveTeamTargets(input: { surveysPerServer: number; surveysPerDelivery: number; positiveQualityPercent: number }) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  await db.insert(teamTargets).values({ id: 1, ...input }).onConflictDoUpdate({ target: teamTargets.id, set: input });
  const rows = await db.select().from(teamTargets).where(eq(teamTargets.id, 1)).limit(1);
  return rows[0];
}

export async function listPriorityItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(priorityItems);
}

export async function savePriorityItem(input: Pick<InsertPriorityItem, "priorityKey" | "status" | "responsible" | "dueDate" | "updatedBy">) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  await db.insert(priorityItems).values(input).onConflictDoUpdate({ target: priorityItems.priorityKey, set: { status: input.status, responsible: input.responsible ?? null, dueDate: input.dueDate ?? null, updatedBy: input.updatedBy ?? null } });
  const historyStatus: "pending" | "in_progress" | "done" = input.status ?? "pending";
  await db.insert(priorityHistory).values({ priorityKey: input.priorityKey, status: historyStatus, responsible: input.responsible ?? null, dueDate: input.dueDate ?? null, changedBy: input.updatedBy ?? "Dashboard" } as any);
  const rows = await db.select().from(priorityItems).where(eq(priorityItems.priorityKey, input.priorityKey)).limit(1);
  return rows[0];
}

export async function listPriorityHistory(priorityKey: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(priorityHistory).where(eq(priorityHistory.priorityKey, priorityKey)).orderBy(desc(priorityHistory.changedAt)).limit(100);
}

export async function listSystemUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).orderBy(users.name);
}

export async function listPromotions() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(promotions).where(eq(promotions.active, 1)).orderBy(promotions.name);
}
export async function listAllPromotions() { const db = await getDb(); if (!db) return []; return db.select().from(promotions).orderBy(promotions.name); }

export async function savePromotion(input: InsertPromotion) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  await db.insert(promotions).values(input).onConflictDoUpdate({ target: promotions.name, set: { category: input.category, active: 1 } });
  return listPromotions();
}
export async function updatePromotion(input: { id: number; name: string; category: "recuperacion" | "cumpleanos" | "fidelidad" | "general"; active: number }) {
  const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible");
  await db.update(promotions).set({ name: input.name, category: input.category, active: input.active }).where(eq(promotions.id, input.id));
  return listPromotions();
}
export async function listResponsibleUsers() { const db = await getDb(); if (!db) return []; return db.select().from(responsibleUsers).where(eq(responsibleUsers.active, 1)).orderBy(responsibleUsers.name); }
export async function listAllResponsibleUsers() { const db = await getDb(); if (!db) return []; return db.select().from(responsibleUsers).orderBy(responsibleUsers.name); }
export async function saveResponsibleUser(input: InsertResponsibleUser) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); await db.insert(responsibleUsers).values(input); return listResponsibleUsers(); }
export async function updateResponsibleUser(input: { id: number; name: string; email?: string | null; active: number }) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); await db.update(responsibleUsers).set({ name: input.name, email: input.email ?? null, active: input.active }).where(eq(responsibleUsers.id, input.id)); return listResponsibleUsers(); }
export async function listTeamTargetHistory() { const db = await getDb(); if (!db) return []; return db.select().from(teamTargetHistory).orderBy(desc(teamTargetHistory.changedAt)).limit(240); }
export async function saveTeamTargetHistory(input: { surveysPerServer: number; surveysPerDelivery: number; positiveQualityPercent: number; periodLabel: string; changedBy?: string | null }) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); await db.insert(teamTargetHistory).values(input); return listTeamTargetHistory(); }
export async function listAdminAuditLog() { const db = await getDb(); if (!db) return []; return db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.changedAt)).limit(300); }
export async function recordAdminAudit(input: { entity: string; action: string; entityId?: string | null; details?: string | null; changedBy: string }) { const db = await getDb(); if (!db) throw new Error("La base de datos no está disponible"); await db.insert(adminAuditLog).values(input); return listAdminAuditLog(); }

/* -------------------------------------------------------------------------- */
/*  Solicitudes de acceso (alta de usuarios con aprobación del administrador)  */
/* -------------------------------------------------------------------------- */

export async function createAccessRequest(input: { name: string; email: string; message?: string | null }): Promise<AccessRequest> {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  const rows = await db.insert(accessRequests).values({ name: input.name, email: input.email, message: input.message ?? null }).returning();
  return rows[0];
}

export async function findUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0];
}

export async function findPendingAccessRequest(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(accessRequests).where(and(eq(accessRequests.email, email), eq(accessRequests.status, "pending"))).limit(1);
  return rows[0];
}

export async function listAccessRequests() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accessRequests).orderBy(desc(accessRequests.requestedAt)).limit(200);
}

export async function getAccessRequest(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(accessRequests).where(eq(accessRequests.id, id)).limit(1);
  return rows[0];
}

export async function markAccessRequest(id: number, status: "approved" | "rejected", reviewedBy: string) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  await db.update(accessRequests).set({ status, reviewedBy, reviewedAt: new Date() }).where(eq(accessRequests.id, id));
}

/** Vincula (o crea) el usuario local con su uuid de Supabase Auth tras aprobar su acceso. */
export async function activateUserFromAuth(input: { email: string; openId: string; name?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("La base de datos no está disponible");
  const existing = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
  if (existing.length) {
    const target = existing[0];
    if (target.openId !== input.openId) {
      // Evita colisión con otra fila local que ya use ese uuid de Supabase.
      await db.delete(users).where(and(eq(users.openId, input.openId), ne(users.id, target.id)));
    }
    const rows = await db
      .update(users)
      .set({ openId: input.openId, name: input.name ?? target.name, loginMethod: "supabase", active: 1, updatedAt: new Date() })
      .where(eq(users.id, target.id))
      .returning();
    return rows[0];
  }
  const rows = await db
    .insert(users)
    .values({ openId: input.openId, name: input.name ?? null, email: input.email, loginMethod: "supabase", active: 1, lastSignedIn: new Date() })
    .returning();
  return rows[0];
}

