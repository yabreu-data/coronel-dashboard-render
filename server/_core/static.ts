import express, { type Express } from "express";
import fs from "fs";
import path from "path";

/**
 * Servido de los archivos estáticos generados por `vite build`.
 * Vive separado de `vite.ts` para que el bundle de producción no requiera las
 * dependencias de desarrollo (vite, plugins de Tailwind/React).
 */
export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    console.error(`Could not find the build directory: ${distPath}, make sure to build the client first`);
  }

  // Los assets llevan hash en el nombre: se pueden cachear. El HTML se sirve
  // por el fallback de abajo con `no-store` para que un despliegue nuevo se
  // refleje al recargar.
  app.use(express.static(distPath, { maxAge: "1h", index: false }));

  // SPA fallback: cualquier ruta sin archivo devuelve index.html.
  app.use("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
