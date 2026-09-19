// ═══════════════════════════════════════════════════════════════
// Lógica pura del diálogo por voz "Manos Libres" (sin DOM).
// Cada función interpreta UNA respuesta hablada del usuario.
// Testeable en Node: scripts/test-voice-dialog.mjs
// ═══════════════════════════════════════════════════════════════

export interface SedeLike { id: string; name: string; city?: string; task?: string }
export interface ProLike { id: string; alias: string; firstName: string; lastName: string }

export function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const MESES_NORM = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const NUM_WORDS: Record<string, number> = {
  primero: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14,
  quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  veintinueve: 29, treinta: 30, treintiuno: 31,
};

const DOW_WORDS: Record<string, number> = {
  lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0,
};

export const REASON_OPTIONS = ["VACACIONES", "BAJA", "FORMACION", "PERMISO", "AUSENCIA"];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const wordMatch = (text: string, token: string) =>
  !!token && new RegExp(`\\b${esc(token)}\\b`).test(text);

// ── Número de lista hablado: "dos", "el 3", "número 2" → 1..max ──
export function parseListNumber(text: string, max: number): number | null {
  const t = norm(text);
  const digit = t.match(/\b(\d{1,2})\b/);
  if (digit) {
    const n = parseInt(digit[1]);
    return n >= 1 && n <= max ? n : null;
  }
  // "número dos" / "la dos" / "dos"
  for (const [w, n] of Object.entries(NUM_WORDS)) {
    if (n > max) continue;
    if (wordMatch(t, w)) return n;
  }
  return null;
}

// ── FECHA: "hoy", "mañana", "pasado mañana", "el día 15", "15 de octubre",
//    "viernes", "el próximo lunes", "15/10", o un número suelto = día ──
export function parseDateAnswer(raw: string, ctxYear: number, ctxMonth: number): string | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let t = norm(raw).replace(/treinta y (uno|un)\b/g, "treintiuno");
  let day = -1, month = -1, resolved = false;

  const resolveDay = (d: number, mo: number): string => {
    let cand = new Date(ctxYear, mo, d);
    if (cand < today) cand = new Date(ctxYear, mo + 1, d); // ya pasó → próximo mes
    return fmt(cand);
  };

  // 1) relativos
  if (/\bpasado\s+manana\b/.test(t)) {
    const c = new Date(today); c.setDate(c.getDate() + 2); return fmt(c);
  }
  if (/\bhoy\b/.test(t)) return fmt(today);
  if (/\bmanana\b/.test(t)) {
    const c = new Date(today); c.setDate(c.getDate() + 1); return fmt(c);
  }

  // 2) N/M o N-M
  const numSlash = t.match(/\b(\d{1,2})\s*[\/\-]\s*(\d{1,2})\b/);
  if (numSlash) {
    day = parseInt(numSlash[1]); month = parseInt(numSlash[2]) - 1;
    if (day >= 1 && day <= 31 && month >= 0 && month <= 11) return resolveDay(day, month);
    day = -1; month = -1;
  }

  // 3) "15 de octubre" / "quince de octubre"
  const monthRe = new RegExp(`\\b(\\d{1,2}|[a-z]+)\\s+(?:de\\s+|del\\s+)?(${MESES_NORM.join("|")})\\b`);
  const mm = t.match(monthRe);
  if (mm) {
    const d = /^\d+$/.test(mm[1]) ? parseInt(mm[1]) : NUM_WORDS[mm[1]] ?? -1;
    const mo = MESES_NORM.indexOf(mm[2]);
    if (d >= 1 && d <= 31 && mo >= 0) return resolveDay(d, mo);
  }

  // 4) "día 15" / "dia quince" (mes visible o el siguiente si ya pasó)
  const dn = t.match(/\b(?:el\s+)?dias?\s+(\d{1,2}|[a-z]+)\b/);
  if (dn) {
    const d = /^\d+$/.test(dn[1]) ? parseInt(dn[1]) : NUM_WORDS[dn[1]] ?? -1;
    if (d >= 1 && d <= 31) return resolveDay(d, ctxMonth);
  }

  // 5) día de la semana ("el viernes", "próximo lunes")
  const dw = t.match(/\b(?:el\s+)?(?:proximo\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)s?\b/);
  if (dw) {
    const target = DOW_WORDS[dw[1]];
    const cand = new Date(today);
    let add = (target - cand.getDay() + 7) % 7;
    if (add === 0) add = /\bproximo\b/.test(dw[0]) ? 7 : 0;
    cand.setDate(cand.getDate() + add);
    return fmt(cand);
  }

  // 6) número suelto: "quince", "20" → día del mes visible
  const bare = t.match(/\b(\d{1,2})\b/);
  if (bare) {
    const d = parseInt(bare[1]);
    if (d >= 1 && d <= 31) return resolveDay(d, ctxMonth);
  }
  for (const [w, n] of Object.entries(NUM_WORDS)) {
    if (wordMatch(t, w)) { resolved = true; return resolveDay(n, ctxMonth); }
  }
  void resolved;

  return null;
}

// ── SEDE: por número de lista o por nombre/ciudad (mejor coincidencia) ──
export function matchSedeAnswer(raw: string, sedes: SedeLike[]): string | null {
  if (sedes.length === 0) return null;
  const t = norm(raw);
  const n = parseListNumber(t, sedes.length);
  if (n) return sedes[n - 1].id;

  let best = 0, hit: string | null = null;
  for (const s of sedes) {
    const nameN = norm(s.name);
    let score = 0;
    if (nameN.length >= 3 && wordMatch(t, nameN)) score = nameN.length;
    else {
      const tokens = nameN.split(" ").filter(x => x.length >= 3).sort((a, b) => b.length - a.length);
      if (tokens.length && wordMatch(t, tokens[0])) score = tokens[0].length;
      else if (s.city && norm(s.city).length >= 3 && wordMatch(t, norm(s.city))) score = norm(s.city).length;
    }
    if (score > best) { best = score; hit = s.id; }
  }
  return hit;
}

export function proLabel(p: ProLike): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

// ── PROFESIONAL: número, nombre/alias, o "toda la sede" (id "") ──
const NONE_PRO = /\b(toda la sede|sede completa|todos|toda|sin profesional|ninguno|nadie|la sede)\b/;

export function matchProAnswer(
  raw: string,
  pros: ProLike[]
): { id: string; label: string } | null {
  const t = norm(raw);
  if (NONE_PRO.test(t)) return { id: "", label: "toda la sede" };
  if (pros.length === 0) return null;

  const n = parseListNumber(t, pros.length);
  if (n) { const p = pros[n - 1]; return { id: p.id, label: proLabel(p) }; }

  let best = 0, hit: { id: string; label: string } | null = null;
  for (const p of pros) {
    const cands: string[] = [];
    if (p.alias && p.alias.length >= 2) cands.push(norm(p.alias));
    for (const part of [p.firstName, p.lastName]) {
      const nn = norm(part);
      if (nn.length >= 3) cands.push(nn);
    }
    for (const c of cands) {
      if (wordMatch(t, c) && c.length > best) {
        best = c.length;
        hit = { id: p.id, label: proLabel(p) };
      }
    }
  }
  return hit;
}

// ── TURNO: palabras o número de lista 1 mañana / 2 tarde / 3 todo el día ──
export function parseTurnAnswer(raw: string): "M" | "T" | "ALL" | null {
  const t = norm(raw);
  if (/\bmananas?\b/.test(t) && /\btardes?\b/.test(t)) return "ALL";
  if (/\b(todo el dia|los dos|ambos|ambas|completo|entero|dia completo|jornada completa)\b/.test(t)) return "ALL";
  if (/\btardes?\b/.test(t)) return "T";
  if (/\bmananas?\b/.test(t)) return "M";
  const n = parseListNumber(t, 3);
  if (n === 1) return "M";
  if (n === 2) return "T";
  if (n === 3) return "ALL";
  return null;
}

// ── MOTIVO: palabra clave o número de lista 1..5 ──
export function parseReasonAnswer(raw: string): string | null {
  const t = norm(raw);
  const checks: [RegExp, string][] = [
    [/\bvacaciones\b/, "VACACIONES"],
    [/\bbajas?\b/, "BAJA"],
    [/\bformaciones?\b|\bcursos?\b/, "FORMACION"],
    [/\bpermisos?\b/, "PERMISO"],
    [/\bausencias?\b|\bfaltas?\b/, "AUSENCIA"],
  ];
  for (const [re, val] of checks) if (re.test(t)) return val;
  const n = parseListNumber(t, REASON_OPTIONS.length);
  if (n) return REASON_OPTIONS[n - 1];
  return null;
}

// ── SÍ / NO ──
export function parseYesNo(raw: string): boolean | null {
  const t = norm(raw);
  if (
    /\b(si|sis|sip|claro|vale|ok|okey|bueno|guardalo|guarda|guardar|guardame|confirmo|confirmar|adelante|correcto|exacto|eso es|venga)\b/.test(t)
  ) return true;
  if (/\b(no|nop|nada|cancela|cancelar|olvidalo|olvida|negativo|descartalo|mal)\b/.test(t)) return false;
  return null;
}

// ── Intenciones globales del diálogo ──
export function wantsStop(raw: string): boolean {
  return /\b(terminar|termina|termino|salir|adios|hasta luego|eso es todo|nada mas|basta|fin|apagate|cierra)\b/.test(norm(raw));
}

export function wantsCancel(raw: string): boolean {
  return /\b(cancela|cancelar|olvidalo|olvida|descarta|descartar|empieza de nuevo|borralo)\b/.test(norm(raw));
}

export function wantsRepeat(raw: string): boolean {
  return /\b(repite|repetir|repetime|otra vez|que dijiste|no te entendi|mas alto)\b/.test(norm(raw));
}

export function wantsAnother(raw: string): boolean {
  return /\b(aviso|otro|otra|si|vale|claro|venga|empezar|nuevo|seguir)\b/.test(norm(raw));
}

// ── Ayudas de locución ──
export function speechList(items: string[]): string {
  if (items.length === 0) return "";
  const numbered = items.map((it, i) => `${i + 1} ${it}`);
  if (numbered.length === 1) return numbered[0];
  return numbered.slice(0, -1).join(", ") + " o " + numbered[numbered.length - 1];
}

export function dateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

const DOW_SHORT = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

// Etiqueta corta para listas en pantalla: "VIE 19/9"
export function shortDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return `${DOW_SHORT[dt.getDay()]} ${dt.getDate()}/${dt.getMonth() + 1}`;
}

// Próximos N días desde hoy (formato ISO) — lista numerada del modo coche
export function upcomingDays(count: number): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    out.push(fmt(d));
  }
  return out;
}

export function turnPhrase(turn: "M" | "T" | "ALL"): string {
  return turn === "M" ? "por la mañana" : turn === "T" ? "por la tarde" : "todo el día";
}
