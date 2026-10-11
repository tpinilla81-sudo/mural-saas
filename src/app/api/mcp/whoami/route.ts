import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api-auth";

// GET /api/mcp/whoami — valida la API key y devuelve el companyId + scopes.
// Claude lo usa como primer paso para confirmar que la key funciona.
export async function GET() {
  const { error, status, companyId, scope } = await requireApiKey("read");
  if (error) return NextResponse.json({ error }, { status });
  return NextResponse.json({
    ok: true,
    companyId,
    scope,
    msg: "API key válida — MURAL conectado a Claude",
    endpoints: [
      "GET /api/mcp/sedes — lista de sedes",
      "GET /api/mcp/profesionales — lista de profesionales",
      "GET /api/mcp/turnos?fecha=YYYY-MM-DD — turnos de un día",
      "GET /api/mcp/avisos?fecha=YYYY-MM-DD — avisos de un día",
      "POST /api/mcp/avisos — crear un aviso (body: { fecha, sede, profesional, turno, motivo, nota })",
      "POST /api/mcp/turnos — crear un turno (body: { fecha, sede, profesional, turno, nota })",
    ],
  });
}
