"use client";

import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════
// Web Speech API — minimal typings
// ═══════════════════════════════════════════════════════════
interface SRAlternative { transcript: string }
interface SRResult { 0: SRAlternative; isFinal: boolean }
interface SREvent { resultIndex: number; results: { length: number } & Record<number, SRResult> }
interface SRInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type SRConstructor = new () => SRInstance;

const AVISO_REASONS = ["VACACIONES", "BAJA", "FORMACION", "PERMISO", "AUSENCIA"];

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

function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface ParsedAviso {
  date: string;            // YYYY-MM-DD
  sedeId: string;          // "" if not detected
  professionalId: string;  // "" = sin profesional
  turn: "M" | "T" | "ALL";
  reason: string;
  note: string;
}

interface SedeLike { id: string; name: string; city?: string; task?: string }
interface ProLike { id: string; alias: string; firstName: string; lastName: string }

// ═══════════════════════════════════════════════════════════
// Parser: texto en español → datos del aviso
// ═══════════════════════════════════════════════════════════
export function parseAvisoText(
  raw: string,
  sedes: SedeLike[],
  pros: ProLike[],
  ctxYear: number,
  ctxMonth: number
): ParsedAviso {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let text = norm(raw);
  // "treinta y uno" → "treintiuno" para poder mapearlo
  text = text.replace(/treinta y (uno|un)\b/g, "treintiuno");

  const result: ParsedAviso = {
    date: "", sedeId: "", professionalId: "", turn: "ALL", reason: "VACACIONES", note: "",
  };

  // ── 1) NOTA: todo lo que va detrás de "nota: ..." / "apunta ..." ──
  const noteMatch = text.match(/\b(?:notas?|apunta|anota[r]?)\b[:,]?\s*(.*)$/);
  if (noteMatch) {
    result.note = (noteMatch[1] || "").trim();
    // quitar la parte de la nota del resto del análisis (y la palabra marcador)
    text = text.slice(0, noteMatch.index).trim();
  }

  // ── 2) MOTIVO por palabra clave ──
  const reasonChecks: [RegExp, string][] = [
    [/\bvacaciones\b/, "VACACIONES"],
    [/\bbaja(s)?\b/, "BAJA"],
    [/\bformacion\b|\bcurso(s)?\b/, "FORMACION"],
    [/\bpermiso(s)?\b/, "PERMISO"],
    [/\bausencia(s)?\b|\bfalta(s)?\b/, "AUSENCIA"],
  ];
  for (const [re, val] of reasonChecks) {
    const m = text.match(re);
    if (m) {
      result.reason = val;
      text = text.replace(m[0], " ");
      break;
    }
  }

  // ── 3) TURNO: frases "por la mañana/tarde", "turno de mañana/tarde" ──
  const tardePhrase = text.match(/\b(por la|de la|turno de|turno)\s+(tardes?|tarde)\b/) || text.match(/\btardes?\b/);
  const mananaPhrase =
    text.match(/\b(por la|de la|turno de|turno)\s+(mananas?|manana)\b/) || text.match(/\bmananas\b/);
  if (tardePhrase) {
    result.turn = "T";
    text = text.replace(tardePhrase[0], " ");
  } else if (mananaPhrase) {
    result.turn = "M";
    text = text.replace(mananaPhrase[0], " ");
  }

  // ── 4) FECHA ──
  let day = -1, month = -1, resolved = false;

  // 4a) N/M o N-M
  const numSlash = text.match(/\b(\d{1,2})\s*[\/\-]\s*(\d{1,2})\b/);
  if (numSlash) {
    day = parseInt(numSlash[1]);
    month = parseInt(numSlash[2]) - 1;
    text = text.replace(numSlash[0], " ");
  }

  // 4b) "15 de octubre" (número o palabra)
  if (!resolved && day < 0) {
    const monthNames = MESES_NORM.join("|");
    const re = new RegExp(`\\b(\\d{1,2}|[a-z]+)\\s+(?:de\\s+)?(${monthNames})\\b`);
    const m = text.match(re);
    if (m) {
      const d = /^\d+$/.test(m[1]) ? parseInt(m[1]) : NUM_WORDS[m[1]] ?? -1;
      const mo = MESES_NORM.indexOf(m[2]);
      if (d >= 1 && d <= 31 && mo >= 0) {
        day = d; month = mo;
        text = text.replace(m[0], " ");
      }
    }
  }

  // 4c) "día 15" / "dia quince" → mes que se está viendo (o el siguiente si ya pasó)
  if (day < 0) {
    const m = text.match(/\b(?:el\s+)?dia\s+(\d{1,2}|[a-z]+)\b/);
    if (m) {
      const d = /^\d+$/.test(m[1]) ? parseInt(m[1]) : NUM_WORDS[m[1]] ?? -1;
      if (d >= 1 && d <= 31) {
        day = d; month = ctxMonth;
        let cand = new Date(ctxYear, month, d);
        if (cand < today) cand = new Date(ctxYear, ctxMonth + 1, d);
        result.date = fmt(cand);
        resolved = true;
        text = text.replace(m[0], " ");
      }
    }
  }

  // 4d) día de la semana ("el viernes", "próximo lunes")
  if (!resolved && day < 0) {
    const m = text.match(/\b(?:el\s+)?(?:proximo\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)s?\b/);
    if (m) {
      const target = DOW_WORDS[m[1]];
      const cand = new Date(today);
      let add = (target - cand.getDay() + 7) % 7;
      if (add === 0) add = /\bproximo\b/.test(m[0]) ? 7 : 0; // "próximo viernes" aunque sea hoy → siguiente
      cand.setDate(cand.getDate() + add);
      result.date = fmt(cand);
      resolved = true;
      text = text.replace(m[0], " ");
    }
  }

  // 4e) relativos: pasado mañana, hoy, mañana
  if (!resolved) {
    if (/\bpasado\s+manana\b/.test(text)) {
      const cand = new Date(today); cand.setDate(cand.getDate() + 2);
      result.date = fmt(cand); resolved = true;
      text = text.replace(/\bpasado\s+manana\b/, " ");
    } else if (/\bhoy\b/.test(text)) {
      result.date = fmt(today); resolved = true;
      text = text.replace(/\bhoy\b/, " ");
    } else if (/\bmanana\b/.test(text)) {
      const cand = new Date(today); cand.setDate(cand.getDate() + 1);
      result.date = fmt(cand); resolved = true;
      text = text.replace(/\bmanana\b/, " ");
    }
  }

  // Resolver día+mes explícito (4a/4b) con año correcto
  if (!resolved && day >= 1 && month >= 0) {
    let cand = new Date(ctxYear, month, day);
    if (cand < today) cand = new Date(ctxYear + 1, month, day);
    result.date = fmt(cand);
    resolved = true;
  }

  if (!result.date) result.date = fmt(today); // por defecto: hoy

  // ── 5) SEDE (matching difuso por nombre o ciudad) ──
  const wordMatch = (token: string) => {
    if (!token) return false;
    const esc = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${esc}\\b`).test(text);
  };
  let bestSedeScore = 0;
  for (const s of sedes) {
    const nameN = norm(s.name);
    let score = 0;
    if (nameN.length >= 3 && wordMatch(nameN)) score = nameN.length;
    else {
      const tokens = nameN.split(" ").filter(t => t.length >= 3).sort((a, b) => b.length - a.length);
      if (tokens.length && wordMatch(tokens[0])) score = tokens[0].length;
      else if (s.city && norm(s.city).length >= 3 && wordMatch(norm(s.city))) score = norm(s.city).length;
    }
    if (score > bestSedeScore) {
      bestSedeScore = score;
      result.sedeId = s.id;
    }
  }

  // ── 6) PROFESIONAL (alias, nombre o apellido) ──
  let bestProScore = 0;
  for (const p of pros) {
    const candidates: string[] = [];
    if (p.alias && p.alias.length >= 2) candidates.push(norm(p.alias));
    for (const part of [p.firstName, p.lastName]) {
      const n = norm(part);
      if (n.length >= 3) candidates.push(n);
    }
    for (const c of candidates) {
      if (wordMatch(c) && c.length > bestProScore) {
        bestProScore = c.length;
        result.professionalId = p.id;
      }
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════
// Modal de captura por voz
// ═══════════════════════════════════════════════════════════
interface VoiceAvisoModalProps {
  onClose: () => void;
  onSaved: () => void;
  sedes: SedeLike[];
  professionals: ProLike[];
  contextYear: number;
  contextMonth: number;
}

export function VoiceAvisoModal({ onClose, onSaved, sedes, professionals, contextYear, contextMonth }: VoiceAvisoModalProps) {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState("");
  const [parsed, setParsed] = useState<ParsedAviso | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [support, setSupport] = useState<"checking" | "yes" | "no">("checking");

  const recRef = useRef<SRInstance | null>(null);
  const finalRef = useRef("");

  const proName = (id: string) => {
    const p = professionals.find(x => x.id === id);
    return p ? `${p.firstName} ${p.lastName}`.trim() : "";
  };
  const sedeName = (id: string) => sedes.find(x => x.id === id)?.name || "";

  useEffect(() => {
    const SR: SRConstructor | undefined =
      (typeof window !== "undefined" &&
        ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      undefined;
    setSupport(SR ? "yes" : "no");
    return () => { try { recRef.current?.abort(); } catch { } };
  }, []);

  const startListening = () => {
    const SR: SRConstructor | undefined =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setSupport("no"); return; }
    setMicError("");
    finalRef.current = "";
    try {
      const rec = new SR();
      rec.lang = "es-ES";
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e: SREvent) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalRef.current += r[0].transcript + " ";
          else interim += r[0].transcript;
        }
        setTranscript((finalRef.current + interim).trim());
      };
      rec.onerror = (e: { error: string }) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setMicError("Permiso de micrófono denegado. Actívalo en el navegador o escribe el aviso.");
        } else if (e.error === "no-speech") {
          setMicError("No se ha oído nada. Pulsa de nuevo y habla.");
        } else {
          setMicError("Error del micrófono: " + e.error);
        }
      };
      rec.onend = () => {
        setListening(false);
        const t = finalRef.current.trim();
        if (t) analyze(t);
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
      setParsed(null);
      setSavedOk(false);
    } catch {
      setMicError("No se pudo iniciar el micrófono.");
      setListening(false);
    }
  };

  const stopListening = () => {
    try { recRef.current?.stop(); } catch { }
    setListening(false);
  };

  const analyze = (text?: string) => {
    const t = (text ?? transcript).trim();
    if (!t) return;
    setParsed(parseAvisoText(t, sedes, professionals, contextYear, contextMonth));
  };

  const update = (patch: Partial<ParsedAviso>) => setParsed(p => (p ? { ...p, ...patch } : p));

  const save = async () => {
    if (!parsed) return;
    if (!parsed.sedeId) { setMicError("Falta la sede: elige una en la vista previa."); return; }
    if (!parsed.date) { setMicError("Falta la fecha."); return; }
    setSaving(true);
    try {
      const turns = parsed.turn === "ALL" ? ["M", "T"] : [parsed.turn];
      let ok = true;
      for (const t of turns) {
        const res = await fetch("/api/company/avisos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: parsed.date,
            sedeId: parsed.sedeId,
            professionalId: parsed.professionalId || null,
            turn: t,
            reason: parsed.reason,
            note: parsed.note,
          }),
        });
        if (!res.ok) ok = false;
      }
      if (ok) {
        setSavedOk(true);
        onSaved();
        setTimeout(onClose, 1100);
      } else {
        setMicError("No se pudo guardar el aviso. Inténtalo de nuevo.");
      }
    } catch {
      setMicError("Error de red al guardar el aviso.");
    } finally {
      setSaving(false);
    }
  };

  const turnLabel = (t: ParsedAviso["turn"]) => (t === "M" ? "Mañana" : t === "T" ? "Tarde" : "Todo el día");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-2 sm:p-4" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-600 rounded-xl p-4 sm:p-5 w-full max-w-md space-y-3 shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-base sm:text-lg">🎙️ Aviso por voz</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none px-1">✕</button>
        </div>

        {/* ── Micrófono ── */}
        {support !== "no" && (
          <div className="flex flex-col items-center gap-2 py-1">
            <button
              onClick={listening ? stopListening : startListening}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-3xl transition-all ${listening
                ? "bg-red-600 text-white animate-pulse ring-4 ring-red-500/40"
                : "bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white ring-4 ring-[#6BBE7A]/20"}`}
              title={listening ? "Parar escucha" : "Pulsa y habla"}
            >
              🎙️
            </button>
            <span className="text-[11px] text-slate-400 font-bold text-center">
              {listening
                ? "Escuchando… di: «el día 15 en Vitoria, Julio, vacaciones, nota: se va de viaje»"
                : "Pulsa el micrófono y di el día, la sede, el profesional y la nota"}
            </span>
          </div>
        )}
        {support === "no" && (
          <p className="text-[11px] text-amber-400 font-bold text-center">
            Tu navegador no soporta dictado por voz. Escribe el aviso abajo y pulsa «Analizar texto».
          </p>
        )}
        {micError && <p className="text-[11px] text-red-400 font-bold text-center">{micError}</p>}

        {/* ── Transcripción (editable) ── */}
        <div>
          <label className="block text-[11px] font-extrabold text-blue-400 uppercase mb-1">Texto del aviso (editable)</label>
          <textarea
            value={transcript}
            onChange={e => { setTranscript(e.target.value); setParsed(null); }}
            rows={2}
            placeholder="Ej.: mañana en Vitoria, Ana, baja médica, nota: vuelve el lunes"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 focus:border-amber-500 rounded-lg text-sm text-white resize-none outline-none transition"
          />
          <button
            onClick={() => analyze()}
            disabled={!transcript.trim()}
            className="mt-1.5 w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white font-bold py-2 rounded-lg text-xs transition"
          >
            🔍 Analizar texto
          </button>
        </div>

        {/* ── Vista previa editable ── */}
        {parsed && (
          <div className={`border rounded-xl p-3 space-y-2.5 transition ${savedOk ? "border-green-500 bg-green-900/20" : "border-slate-600 bg-slate-900/60"}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-blue-400 uppercase">Aviso detectado — revisa y guarda</span>
              {savedOk && <span className="text-green-400 font-black text-sm">✓ Guardado</span>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Fecha</label>
                <input
                  type="date"
                  value={parsed.date}
                  onChange={e => update({ date: e.target.value })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Turno</label>
                <select
                  value={parsed.turn}
                  onChange={e => update({ turn: e.target.value as ParsedAviso["turn"] })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs"
                >
                  <option value="ALL">Todo el día</option>
                  <option value="M">Mañana</option>
                  <option value="T">Tarde</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={`block text-[10px] font-bold uppercase mb-0.5 ${parsed.sedeId ? "text-slate-400" : "text-red-400 animate-pulse"}`}>
                  Sede {parsed.sedeId ? "" : "(elige)"}
                </label>
                <select
                  value={parsed.sedeId}
                  onChange={e => update({ sedeId: e.target.value })}
                  className={`w-full px-2 py-1.5 bg-slate-800 border rounded text-white text-xs ${parsed.sedeId ? "border-slate-600" : "border-red-500"}`}
                >
                  <option value="">— Selecciona sede —</option>
                  {sedes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Profesional</label>
                <select
                  value={parsed.professionalId}
                  onChange={e => update({ professionalId: e.target.value })}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs"
                >
                  <option value="">Sin profesional (sede)</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.alias} - {p.firstName}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Motivo</label>
              <select
                value={parsed.reason}
                onChange={e => update({ reason: e.target.value })}
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-white text-xs"
              >
                {AVISO_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-0.5">Nota</label>
              <textarea
                value={parsed.note}
                onChange={e => update({ note: e.target.value })}
                rows={2}
                maxLength={2000}
                placeholder="Nota del aviso (se ve al pulsar la tarjeta en Mensual)…"
                className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 focus:border-amber-500 rounded text-white text-xs resize-none outline-none transition"
              />
            </div>
            <div className="text-[10px] text-slate-400 font-bold text-center">
              {parsed.date && parsed.sedeId
                ? `${turnLabel(parsed.turn)} · ${sedeName(parsed.sedeId)}${parsed.professionalId ? ` · ${proName(parsed.professionalId)}` : " · sin profesional"} · ${parsed.reason}`
                : "Selecciona sede y fecha para guardar"}
            </div>
            <button
              onClick={save}
              disabled={saving || savedOk || !parsed.sedeId || !parsed.date}
              className="w-full bg-[#2E5D3A] hover:bg-[#3a7a4c] disabled:opacity-40 text-white font-black py-2.5 rounded-lg text-sm transition"
            >
              {saving ? "Guardando…" : savedOk ? "✓ Aviso guardado" : `Guardar aviso (${turnLabel(parsed.turn)})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Botón + modal listos para insertar en las toolbars
// ═══════════════════════════════════════════════════════════
interface VoiceAvisoButtonProps {
  sedes: SedeLike[];
  professionals: ProLike[];
  onSaved: () => void;
  contextYear: number;
  contextMonth: number;
}

export default function VoiceAvisoButton({ sedes, professionals, onSaved, contextYear, contextMonth }: VoiceAvisoButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white font-black px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition shrink-0"
        title="Añadir aviso dictando por voz"
      >
        🎙️<span className="hidden sm:inline"> Aviso por voz</span><span className="sm:hidden"> Voz</span>
      </button>
      {open && (
        <VoiceAvisoModal
          onClose={() => setOpen(false)}
          onSaved={onSaved}
          sedes={sedes}
          professionals={professionals}
          contextYear={contextYear}
          contextMonth={contextMonth}
        />
      )}
    </>
  );
}
