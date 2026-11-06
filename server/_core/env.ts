export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Supabase (PostgreSQL + Auth)
  supabaseUrl: (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, ""),
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  /** Usuario de Supabase Auth que recibe el rol administrador inicial. */
  supabaseAdminUserId: process.env.SUPABASE_ADMIN_USER_ID ?? process.env.OWNER_OPEN_ID ?? "",
  // Google Sheets (fuente de encuestas y catálogo de meseros)
  googleSheetId: process.env.GOOGLE_SHEET_ID ?? "1q9WMz_O_J15B0QKv8QF4zYp7uvwGwm-5aTGfTdz6vHU",
  googleSheetTab: process.env.GOOGLE_SHEET_TAB ?? "",
  adminPin: process.env.ADMIN_PIN ?? "5956",
};
