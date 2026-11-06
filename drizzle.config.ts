import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

/**
 * Supabase (PostgreSQL) exige TLS. `pg` >= 8.20 interpreta `sslmode=require`
 * como verify-full y falla con el certificado del pooler, por eso usamos
 * `sslmode=no-verify` (equivalente al comportamiento clásico de require).
 */
function withSslMode(url: string) {
  if (/sslmode=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}sslmode=no-verify`;
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: withSslMode(connectionString),
  },
  verbose: true,
  strict: false,
});
