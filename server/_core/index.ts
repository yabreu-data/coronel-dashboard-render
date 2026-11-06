import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { closeDb } from "../db";
import { createContext } from "./context";
import { ENV } from "./env";
import { serveStatic } from "./static";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Render termina TLS en su proxy: confiamos en X-Forwarded-* para IP y protocolo.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Health check para Render (y para verificar configuración en caliente).
  app.get("/healthz", (_req, res) => {
    res.json({
      ok: true,
      service: "coronel-satisfaccion-dashboard",
      database: Boolean(process.env.DATABASE_URL),
      supabase: Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey),
      googleSheets: Boolean(process.env.GOOGLE_SHEET_ID),
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number.parseInt(process.env.PORT || "3000", 10);
  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
  });

  const shutdown = (signal: string) => {
    console.log(`[Server] ${signal} recibido, cerrando…`);
    server.close(() => {
      void closeDb().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer().catch(error => {
  console.error("[Server] Falló el arranque:", error);
  process.exit(1);
});
