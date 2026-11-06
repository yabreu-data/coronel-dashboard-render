import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const csv = [
  '"ID Único","Timestamp","ID Mesero","ID Fuente","Plato(s) Original(es)","Opinión del Producto y Mejoras","Calidad del Producto","Registrado Por Original"',
  '"ENC-1","22/09/2026 12:00:00","MES-000001","SRC-000002","Pollo","Muy bueno","Bueno","BETTY"',
  '"ENC-2","22/09/2026 13:00:00","","SRC-000001","Parrillas","Llegó rápido","Bueno","Cliente (Formulario Web)"',
].join("\n");
const catalogCsv = [
  '"ID Mesero","Nombre","Fecha de Registro","Activo"',
  '"MES-000001","BETTY","19/9/2026","Sí"',
  '"MES-000002","SHIRLEY","20/9/2026","Sí"',
].join("\n");

const context = { user: undefined, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] } satisfies TrpcContext;

/**
 * Cada prueba usa un GOOGLE_SHEET_ID distinto para aislar la caché en memoria
 * de 60 s que comparten las pruebas dentro del mismo módulo.
 */
function stubSheetEnv(tab: string | undefined, sheetId: string) {
  if (tab === undefined) vi.stubEnv("GOOGLE_SHEET_TAB", "");
  else vi.stubEnv("GOOGLE_SHEET_TAB", tab);
  vi.stubEnv("GOOGLE_SHEET_ID", sheetId);
}

describe("survey.latest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("lee los nombres actuales de mesero, registrador y plato", async () => {
    stubSheetEnv("Encuestas_Limpias", "sheet-test-1");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(String(input).includes("sheet=Meseros") ? catalogCsv : csv, { status: 200 })));
    const result = await appRouter.createCaller(context).survey.latest();
    expect(result.source).toBe("Google Sheets · Encuestas_Limpias");
    expect(result.records).toEqual([
      expect.objectContaining({ id: "ENC-1", dish: "Pollo", registeredBy: "BETTY" }),
      expect.objectContaining({ id: "ENC-2", dish: "Parrillas", registeredBy: "Cliente (Formulario Web)" }),
    ]);
    expect(result.serverCatalog).toEqual([
      { id: "MES-000001", name: "BETTY", active: true },
      { id: "MES-000002", name: "SHIRLEY", active: true },
    ]);
  });

  it("usa el mapeo descriptivo de la fuente limpia sin duplicar filas vacías", async () => {
    stubSheetEnv("Encuestas_Limpias", "sheet-test-2");
    const cleanCsv = [
      '"ID Único","ID de Envío","Timestamp","Nombre Cliente","Número Contacto","Cumpleaños Original","Productos Normalizados","Opinión Limpia","Mesero","Calidad Limpia"',
      '"UNICO-1","ENVIO-1","22/09/2026 12:00:00","Ana","999111222","29/02","Pollo; Otros","Muy rico","MES-000001","Bueno"',
      '"","","","","","","","","",""',
    ].join("\n");
    const requestedUrls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      return new Response(url.includes("sheet=Meseros") ? catalogCsv : cleanCsv, { status: 200 });
    }));
    const result = await appRouter.createCaller(context).survey.latest({ tab: "limpia" });
    expect(result.source).toBe("Google Sheets · Encuestas_Limpias");
    expect(requestedUrls.some(url => url.includes("sheet=Encuestas_Limpias"))).toBe(true);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({ id: "UNICO-1", dish: "Pollo; Otros", comment: "Muy rico", quality: "Bueno", birthday: "29/02" });
  });

  it("devuelve una fuente limpia vacía mientras la pestaña temporal no tenga estructura de encuestas", async () => {
    stubSheetEnv("Encuestas_Limpias", "sheet-test-3");
    const temporaryBirthdayCsv = '"","CUMPLEAÑEROS DEL MES","","","TEMPORAL"\n"","10","","","Se actualiza"\n"","Nombre","","",""';
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => new Response(String(input).includes("sheet=Meseros") ? catalogCsv : temporaryBirthdayCsv, { status: 200 })));
    const result = await appRouter.createCaller(context).survey.latest({ tab: "limpia" });
    expect(result.source).toBe("Google Sheets · Encuestas_Limpias");
    expect(result.records).toEqual([]);
  });

  it("usa GOOGLE_SHEET_TAB como fuente productiva cuando está configurada", async () => {
    stubSheetEnv("Encuestas", "sheet-test-4");
    const requestedUrls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      requestedUrls.push(url);
      return new Response(url.includes("sheet=Meseros") ? catalogCsv : csv, { status: 200 });
    }));
    const result = await appRouter.createCaller(context).survey.latest();
    expect(result.source).toBe("Google Sheets · Encuestas");
    expect(requestedUrls.some(url => url.includes("sheet=Encuestas&"))).toBe(true);
    expect(result.records).toHaveLength(2);
  });

  it("cae a la pestaña Encuestas si la pestaña configurada no tiene estructura válida", async () => {
    stubSheetEnv("Encuestas_Limpias", "sheet-test-5");
    const temporaryBirthdayCsv = '"","CUMPLEAÑEROS DEL MES","","","TEMPORAL"\n"","10","","","Se actualiza"';
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("sheet=Meseros")) return new Response(catalogCsv, { status: 200 });
      if (url.includes("sheet=Encuestas_Limpias")) return new Response(temporaryBirthdayCsv, { status: 200 });
      return new Response(csv, { status: 200 });
    }));
    const result = await appRouter.createCaller(context).survey.latest({ tab: "limpia" });
    expect(result.source).toBe("Google Sheets · Encuestas");
    expect(result.records).toHaveLength(2);
  });
});
