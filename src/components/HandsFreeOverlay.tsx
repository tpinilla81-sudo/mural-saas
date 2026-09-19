"use client";

import { useEffect, useRef, useState } from "react";
import {
  dateLabel,
  matchProAnswer,
  matchSedeAnswer,
  norm,
  parseDateAnswer,
  parseReasonAnswer,
  parseTurnAnswer,
  parseYesNo,
  proLabel,
  REASON_OPTIONS,
  speechList,
  turnPhrase,
  wantsAnother,
  wantsCancel,
  wantsRepeat,
  wantsStop,
  type ProLike,
  type SedeLike,
} from "@/lib/voice-dialog";

// ═══════════════════════════════════════════════════════════════
// MANOS LIBRES — diálogo 100% por voz para usar mientras se conduce.
// Una pulsación para arrancar (gesto requerido por el navegador);
// a partir de ahí la app pregunta por altavoz y escucha las
// respuestas: día → sede → profesional → turno → motivo → nota →
// confirmación "¿Guardo?". Bucle hasta decir "terminar".
// ═══════════════════════════════════════════════════════════════

// Web Speech API — typings mínimos
interface SRAlternative { transcript: string }
interface SRResult { 0: SRAlternative; isFinal: boolean }
interface SREvent { resultIndex: number; results: { length: number } & Record<number, SRResult> }
interface SRInstance {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type SRConstructor = new () => SRInstance;

type Step = "date" | "sede" | "pro" | "turn" | "reason" | "note" | "noteText" | "confirm" | "saving" | "again";

interface Draft {
  date: string;
  sedeId: string;
  professionalId: string;
  turn: "M" | "T" | "ALL";
  reason: string;
  note: string;
}

interface HandsFreeOverlayProps {
  onClose: () => void;
  onSaved: () => void;
  sedes: SedeLike[];
  professionals: ProLike[];
  contextYear: number;
  contextMonth: number;
}

const emptyDraft = (): Draft => ({
  date: "", sedeId: "", professionalId: "", turn: "ALL", reason: "VACACIONES", note: "",
});

export default function HandsFreeOverlay({
  onClose, onSaved, sedes, professionals, contextYear, contextMonth,
}: HandsFreeOverlayProps) {
  const [step, setStep] = useState<Step>("date");
  const [question, setQuestion] = useState("Preparando manos libres…");
  const [heard, setHeard] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [listening, setListening] = useState(false);
  const [fatal, setFatal] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const draftRef = useRef<Draft>(emptyDraft());
  const stepRef = useRef<Step>("date");
  const recRef = useRef<SRInstance | null>(null);
  const abortRef = useRef(false);
  const failRef = useRef(0);
  const lastQuestionRef = useRef("");
  const askRef = useRef<(step: Step, text: string, echo?: string) => void>(() => {});
  const handlerRef = useRef<(raw: string) => void>(() => {});
  const closeRef = useRef<(msg?: string) => void>(() => {});

  const addLog = (line: string) =>
    setLog(prev => [...prev.slice(-7), line]);

  const setDraftField = (patch: Partial<Draft>) => {
    draftRef.current = { ...draftRef.current, ...patch };
    setDraft(draftRef.current);
  };

  // ── Texto a voz (con fallback por si onend nunca dispara) ──
  const speak = (text: string) =>
    new Promise<void>(resolve => {
      try {
        const synth = window.speechSynthesis;
        if (!synth) { resolve(); return; }
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "es-ES";
        u.rate = 1.02;
        const v = synth.getVoices().find(x => (x.lang || "").toLowerCase().startsWith("es"));
        if (v) u.voice = v;
        let done = false;
        const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
        u.onend = finish;
        u.onerror = finish;
        const timer = setTimeout(finish, Math.max(2200, text.length * 85));
        synth.speak(u);
      } catch {
        resolve();
      }
    });

  const close = async (msg?: string) => {
    abortRef.current = true;
    try { recRef.current?.abort(); } catch { /* noop */ }
    if (msg) await speak(msg);
    try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    onClose();
  };
  closeRef.current = close;

  // ── Escuchar una respuesta ──
  const listen = () => {
    if (abortRef.current) return;
    const SR: SRConstructor | undefined =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setFatal("Tu navegador no soporta reconocimiento de voz. Usa el botón 🎙️ normal.");
      return;
    }
    try {
      const rec = new SR();
      recRef.current = rec;
      rec.lang = "es-ES";
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      let final = "";
      rec.onresult = (e: SREvent) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) final += r[0].transcript + " ";
          else interim += r[0].transcript;
        }
        setHeard((final + interim).trim());
      };
      rec.onerror = (e: { error: string }) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          abortRef.current = true;
          setFatal("Micrófono bloqueado. Cierra y vuelve a pulsar MANOS LIBRES permitiendo el micrófono.");
        }
      };
      rec.onend = () => {
        setListening(false);
        if (abortRef.current) return;
        const txt = final.trim();
        if (txt) {
          failRef.current = 0;
          handlerRef.current(txt);
        } else {
          failRef.current++;
          if (failRef.current >= 3) {
            setFatal("No te oigo. Manos libres detenido — acércate al móvil o pulsa el botón otra vez.");
            return;
          }
          askRef.current(stepRef.current, `No te oigo bien. ${lastQuestionRef.current}`);
        }
      };
      setHeard("");
      setListening(true);
      rec.start();
    } catch {
      setFatal("No se pudo iniciar el micrófono.");
    }
  };

  // ── Hacer una pregunta (echo = confirmación de lo anterior) ──
  const ask = (step: Step, text: string, echo = "") => {
    if (abortRef.current) return;
    stepRef.current = step;
    setStep(step);
    lastQuestionRef.current = text;
    const full = echo ? `${echo}. ${text}` : text;
    setQuestion(full);
    setHeard("");
    addLog(`🔊 ${full}`);
    void speak(full).then(() => {
      if (!abortRef.current) listen();
    });
  };
  askRef.current = ask;

  // ── Confirmación y guardado ──
  const askConfirm = () => {
    const d = draftRef.current;
    const sedeName = sedes.find(s => s.id === d.sedeId)?.name || "";
    const proName = d.professionalId
      ? (() => { const p = professionals.find(x => x.id === d.professionalId); return p ? proLabel(p) : ""; })()
      : "toda la sede";
    const parts = [
      `El ${dateLabel(d.date)}`,
      `en ${sedeName}`,
      `para ${proName}`,
      turnPhrase(d.turn),
      d.reason.toLowerCase(),
      d.note ? `nota: ${d.note}` : "",
    ].filter(Boolean);
    ask("confirm", `${parts.join(", ")}. ¿Guardo? Di sí o no.`);
  };

  const save = async () => {
    stepRef.current = "saving";
    setStep("saving");
    const d = draftRef.current;
    const turns = d.turn === "ALL" ? ["M", "T"] : [d.turn];
    let errMsg = "";
    try {
      for (const t of turns) {
        const res = await fetch("/api/company/avisos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: d.date,
            sedeId: d.sedeId,
            professionalId: d.professionalId || null,
            turn: t,
            reason: d.reason,
            note: d.note,
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          errMsg = (j as { error?: string }).error || `Error ${res.status}`;
          break;
        }
      }
    } catch {
      errMsg = "Error de red";
    }
    if (errMsg) {
      onSaved();
      ask("again", `No se pudo guardar: ${errMsg}. ¿Otro aviso? Di aviso o terminar.`, "Atención");
      return;
    }
    onSaved();
    ask("again", "Aviso guardado. ¿Otro aviso? Di aviso para continuar, o terminar para salir.");
  };

  // ── Reparto de respuestas por paso ──
  const handleAnswer = (raw: string) => {
    addLog(`🧑 ${raw}`);
    if (wantsStop(raw)) { void close("Modo manos libres terminado. ¡Hasta luego!"); return; }
    if (wantsRepeat(raw)) { ask(stepRef.current, lastQuestionRef.current); return; }
    if (wantsCancel(raw) && stepRef.current !== "again") {
      draftRef.current = emptyDraft();
      setDraft(draftRef.current);
      ask("again", "Aviso cancelado. ¿Otro aviso? Di aviso para continuar, o terminar para salir.");
      return;
    }

    const sedeQuestion = () =>
      `¿En qué sede? Di el número: ${speechList(sedes.map(s => s.name))}.`;
    const proQuestion = () =>
      `¿Para quién? Di el número: ${speechList(professionals.map(p => `${p.alias}, ${p.firstName}`))}. O di: toda la sede.`;

    switch (stepRef.current) {
      case "date": {
        const date = parseDateAnswer(raw, contextYear, contextMonth);
        if (!date) {
          ask("date", "No he entendido el día. Dime: hoy, mañana, el día quince, o un día de la semana.");
          return;
        }
        setDraftField({ date });
        if (sedes.length === 1) {
          setDraftField({ sedeId: sedes[0].id });
          ask("pro", proQuestion(), `El ${dateLabel(date)}, en ${sedes[0].name}`);
        } else {
          ask("sede", sedeQuestion(), `El ${dateLabel(date)}`);
        }
        return;
      }
      case "sede": {
        const id = matchSedeAnswer(raw, sedes);
        if (!id) { ask("sede", sedeQuestion(), "No he entendido la sede."); return; }
        setDraftField({ sedeId: id });
        const name = sedes.find(s => s.id === id)?.name || "";
        ask("pro", proQuestion(), `En ${name}`);
        return;
      }
      case "pro": {
        const hit = matchProAnswer(raw, professionals);
        if (!hit) { ask("pro", proQuestion(), "No he entendido. Di el número o el nombre."); return; }
        setDraftField({ professionalId: hit.id });
        ask("turn", "¿Qué turno? Di: mañana, tarde, o todo el día.", hit.id ? hit.label : "Para toda la sede");
        return;
      }
      case "turn": {
        const turn = parseTurnAnswer(raw);
        if (!turn) { ask("turn", "¿Qué turno? Di: mañana, tarde, o todo el día.", "No he entendido el turno."); return; }
        setDraftField({ turn });
        ask("reason", `¿Y el motivo? Di el número: ${speechList(REASON_OPTIONS.map(r => r.toLowerCase()))}.`, turnPhrase(turn));
        return;
      }
      case "reason": {
        const reason = parseReasonAnswer(raw);
        if (!reason) {
          ask("reason", `No he entendido. Di el número: ${speechList(REASON_OPTIONS.map(r => r.toLowerCase()))}.`);
          return;
        }
        setDraftField({ reason });
        ask("note", "¿Añado una nota? Di la nota ahora, o di no.");
        return;
      }
      case "note": {
        const yn = parseYesNo(raw);
        if (yn === false) { setDraftField({ note: "" }); askConfirm(); return; }
        if (yn === true) { ask("noteText", "Dime la nota."); return; }
        setDraftField({ note: raw.trim() });
        askConfirm();
        return;
      }
      case "noteText": {
        setDraftField({ note: raw.trim() });
        askConfirm();
        return;
      }
      case "confirm": {
        const yn = parseYesNo(raw);
        if (yn === true) { void save(); return; }
        if (yn === false) {
          draftRef.current = emptyDraft();
          setDraft(draftRef.current);
          ask("again", "Aviso descartado. ¿Otro aviso? Di aviso para continuar, o terminar para salir.");
          return;
        }
        ask("confirm", "¿Guardo el aviso? Di sí o no.", "No he entendido");
        return;
      }
      case "saving":
        return;
      case "again": {
        if (wantsAnother(raw)) {
          draftRef.current = emptyDraft();
          setDraft(draftRef.current);
          ask("date", "Vamos de otro. Dime el día del aviso.");
          return;
        }
        if (parseYesNo(raw) === false) { void close("Hasta luego."); return; }
        ask("again", "Di aviso para otro, o terminar para salir.");
        return;
      }
    }
  };
  handlerRef.current = handleAnswer;

  // ── Arranque ──
  useEffect(() => {
    const SR: SRConstructor | undefined =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const hasTTS = typeof window !== "undefined" && "speechSynthesis" in window;
    if (!SR || !hasTTS) {
      setFatal("Este navegador no soporta conversación por voz. Usa el botón 🎙️ normal.");
      return;
    }
    if (sedes.length === 0) {
      setFatal("No hay sedes cargadas. Vuelve a la app y espera a que carguen los datos.");
      return;
    }
    // warm-up de voces (Chrome las carga en diferido)
    try { window.speechSynthesis.getVoices(); } catch { /* noop */ }
    abortRef.current = false;
    failRef.current = 0;
    const t = setTimeout(() => {
      askRef.current("date", "Manos libres activado. Dime el día del aviso. Por ejemplo: hoy, mañana, o el día quince.");
    }, 400);
    return () => {
      abortRef.current = true;
      clearTimeout(t);
      try { recRef.current?.abort(); } catch { /* noop */ }
      try { window.speechSynthesis?.cancel(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepLabel: Record<Step, string> = {
    date: "1 · DÍA",
    sede: "2 · SEDE",
    pro: "3 · PROFESIONAL",
    turn: "4 · TURNO",
    reason: "5 · MOTIVO",
    note: "6 · NOTA",
    noteText: "6 · NOTA",
    confirm: "7 · CONFIRMAR",
    saving: "GUARDANDO…",
    again: "¿OTRO AVISO?",
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-[#0b1120]/[0.985] text-slate-100 flex flex-col"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* Cabecera */}
      <header className="flex items-center gap-3 px-4 shrink-0">
        <span className="text-2xl sm:text-3xl">🔊</span>
        <div className="leading-none">
          <h2 className="text-lg sm:text-2xl font-black tracking-wide text-white">MANOS LIBRES</h2>
          <p className="text-[10px] sm:text-xs font-bold text-[#6BBE7A] uppercase tracking-widest mt-0.5">
            {fatal ? "Detenido" : listening ? "Escuchando…" : "Hablando…"}
          </p>
        </div>
        <button
          onClick={() => closeRef.current()}
          className="ml-auto bg-red-600/90 hover:bg-red-600 text-white font-black px-5 py-3 rounded-2xl text-base sm:text-lg shadow-lg active:scale-95 transition"
        >
          ■ PARAR
        </button>
      </header>

      {/* Punto de estado */}
      <div className="flex items-center justify-center gap-2 py-2 shrink-0">
        <span
          className={`h-3.5 w-3.5 rounded-full ${fatal ? "bg-red-500" : listening ? "bg-[#6BBE7A] animate-pulse" : "bg-amber-400"}`}
        />
        <span className="text-xs sm:text-sm font-black uppercase tracking-[3px] text-slate-400">
          {stepLabel[step]}
        </span>
      </div>

      {fatal ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
          <span className="text-6xl">⚠️</span>
          <p className="text-lg sm:text-2xl font-bold text-amber-300 max-w-md">{fatal}</p>
          <button
            onClick={onClose}
            className="bg-slate-800 border border-slate-600 hover:bg-slate-700 text-white font-black px-8 py-3 rounded-2xl text-lg transition"
          >
            CERRAR
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 px-4 sm:px-8 gap-3 max-w-3xl w-full mx-auto">
          {/* Pregunta actual */}
          <div className="bg-slate-900/70 border-2 border-[#6BBE7A]/40 rounded-2xl p-4 sm:p-6 text-center">
            <p className="text-xl sm:text-3xl font-black leading-snug text-white">{question}</p>
          </div>

          {/* Lo que se oye */}
          <div className="min-h-[3.5rem] flex items-center justify-center">
            <p className={`text-lg sm:text-2xl font-bold text-center ${heard ? "text-amber-300 italic" : "text-slate-600"}`}>
              {heard ? `“${heard}”` : "…"}
            </p>
          </div>

          {/* Borrador en curso */}
          <div className="bg-slate-900/50 border border-slate-700 rounded-2xl px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
            <DraftCell label="Día" value={draft.date ? dateLabel(draft.date) : ""} />
            <DraftCell label="Sede" value={sedes.find(s => s.id === draft.sedeId)?.name || ""} />
            <DraftCell
              label="Quién"
              value={
                draft.professionalId
                  ? (() => { const p = professionals.find(x => x.id === draft.professionalId); return p ? proLabel(p) : ""; })()
                  : draft.sedeId ? "Toda la sede" : ""
              }
            />
            <DraftCell label="Turno" value={draft.turn && draft.sedeId ? turnPhrase(draft.turn) : ""} />
            <DraftCell label="Motivo" value={draft.reason} />
            <DraftCell label="Nota" value={draft.note} />
          </div>

          {/* Registro de la conversación */}
          <div className="flex-1 min-h-0 overflow-y-auto text-[11px] sm:text-sm text-slate-400 font-semibold space-y-1 pb-1">
            {log.map((l, i) => (
              <p key={i} className={l.startsWith("🧑") ? "text-amber-300/90" : "text-slate-400"}>{l}</p>
            ))}
          </div>

          <p className="text-center text-[10px] sm:text-xs text-slate-500 font-bold shrink-0">
            Di «cancela» para empezar el aviso de nuevo · «repite» para oír la pregunta otra vez · «terminar» para salir
          </p>
        </div>
      )}
    </div>
  );
}

function DraftCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-xs sm:text-sm font-black text-slate-200 capitalize truncate">{value || "—"}</div>
    </div>
  );
}
