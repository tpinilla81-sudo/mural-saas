"use client";

import { useEffect, useRef, useState } from "react";
import {
  dateLabel,
  matchProAnswer,
  matchSedeAnswer,
  norm,
  parseDateAnswer,
  parseListNumber,
  parseTurnAnswer,
  parseYesNo,
  proLabel,
  shortDateLabel,
  turnPhrase,
  upcomingDays,
  wantsAnother,
  wantsCancel,
  wantsRepeat,
  wantsStop,
  type ProLike,
  type SedeLike,
} from "@/lib/voice-dialog";

// ═══════════════════════════════════════════════════════════════
// MANOS LIBRES — estilo CarPlay: cada paso muestra una LISTA
// NUMERADA EN PANTALLA y la app solo dice "elige número".
// El conductor responde con el número ("dos", "el 3") — rápido,
// fiable y sin escuchar listas largas por altavoz.
// Flujo: día → sede → profesional → turno → ¿nota? (sí/no) →
// confirmación. Tras guardar: "¿Igual, nuevo o terminar?"
// Sin MOTIVO: la tarjeta ya se identifica con profesional + sede
// + día; si el conductor quiere detalle, dicta una nota libre.
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

type Step = "date" | "sede" | "pro" | "turn" | "note" | "noteText" | "confirm" | "saving" | "again";

interface ListItem { n: number; label: string; sub?: string }

interface AskPayload {
  title: string;      // pregunta grande en pantalla
  say: string;        // lo que se lee por altavoz (corto)
  items?: ListItem[]; // lista numerada en pantalla (si aplica)
  echo?: string;      // confirmación en pantalla de la elección anterior
}

interface Draft {
  date: string;
  sedeId: string;
  professionalId: string;
  turn: "M" | "T" | "ALL";
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
  date: "", sedeId: "", professionalId: "", turn: "ALL", note: "",
});

// Sin pregunta de motivo: la tarjeta ya dice quién/dónde/cuándo.
// Valor genérico que la app ya usa como fallback en todas las vistas.
const DEFAULT_REASON = "AUSENCIA";

const DATE_LIST_SIZE = 10;

export default function HandsFreeOverlay({
  onClose, onSaved, sedes, professionals, contextYear, contextMonth,
}: HandsFreeOverlayProps) {
  const [step, setStep] = useState<Step>("date");
  const [title, setTitle] = useState("Preparando manos libres…");
  const [items, setItems] = useState<ListItem[]>([]);
  const [echo, setEcho] = useState("");
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
  const lastAskRef = useRef<AskPayload>({ title: "", say: "" });
  // Memoria del último aviso guardado — para el atajo "igual"
  const lastRef = useRef<{ sedeId: string; professionalId: string; turn: "M" | "T" | "ALL" } | null>(null);
  const skipSedeProTurnRef = useRef(false);
  const askRef = useRef<(payload: AskPayload) => void>(() => {});
  const handlerRef = useRef<(raw: string) => void>(() => {});
  const closeRef = useRef<(msg?: string) => void>(() => {});

  const addLog = (line: string) =>
    setLog(prev => [...prev.slice(-6), line]);

  const setDraftField = (patch: Partial<Draft>) => {
    draftRef.current = { ...draftRef.current, ...patch };
    setDraft(draftRef.current);
  };

  // ── Texto a voz (rate alto: frases cortas, menos espera) ──
  const speak = (text: string) =>
    new Promise<void>(resolve => {
      try {
        const synth = window.speechSynthesis;
        if (!synth) { resolve(); return; }
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "es-ES";
        u.rate = 1.15;
        const v = synth.getVoices().find(x => (x.lang || "").toLowerCase().startsWith("es"));
        if (v) u.voice = v;
        let done = false;
        const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
        u.onend = finish;
        u.onerror = finish;
        const timer = setTimeout(finish, Math.max(1800, text.length * 70));
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
          askRef.current(stepRef.current, { ...lastAskRef.current, say: `No te oigo. ${lastAskRef.current.say}` });
        }
      };
      setHeard("");
      setListening(true);
      rec.start();
    } catch {
      setFatal("No se pudo iniciar el micrófono.");
    }
  };

  // ── Hacer una pregunta: paso + título + lista en pantalla + frase corta por voz ──
  const ask = (step: Step, payload: AskPayload) => {
    if (abortRef.current) return;
    stepRef.current = step;
    setStep(step);
    lastAskRef.current = payload;
    setTitle(payload.title);
    setItems(payload.items || []);
    if (payload.echo !== undefined) setEcho(payload.echo);
    setHeard("");
    addLog(`🔊 ${payload.say}`);
    void speak(payload.say).then(() => {
      if (!abortRef.current) listen();
    });
  };
  askRef.current = ask;
  const gotoRef = useRef<(step: Step, payload: AskPayload) => void>(ask);
  gotoRef.current = ask;

  // ── Listas numeradas en pantalla ──
  const dateOptions = (): ListItem[] => {
    const days = upcomingDays(DATE_LIST_SIZE);
    return days.map((ds, i) => {
      const d = new Date(ds + "T00:00:00");
      const dow = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"][d.getDay()];
      const label = i === 0 ? "HOY" : i === 1 ? "MAÑANA" : dow;
      const sub = i <= 1 ? shortDateLabel(ds) : `${d.getDate()}/${d.getMonth() + 1}`;
      return { n: i + 1, label, sub };
    });
  };
  const sedeOptions = (): ListItem[] =>
    sedes.map((s, i) => ({ n: i + 1, label: s.name, sub: s.city || s.task || "" }));
  const proOptions = (): ListItem[] => [
    ...professionals.map((p, i) => ({ n: i + 1, label: p.alias, sub: proLabel(p) })),
    { n: professionals.length + 1, label: "TODA LA SEDE", sub: "aviso sin profesional" },
  ];
  const turnOptions = (): ListItem[] => [
    { n: 1, label: "MAÑANA", sub: "turno M" },
    { n: 2, label: "TARDE", sub: "turno T" },
    { n: 3, label: "TODO EL DÍA", sub: "mañana + tarde" },
  ];
  const noteOptions = (): ListItem[] => [
    { n: 1, label: "SÍ", sub: "dictar una nota" },
    { n: 2, label: "NO", sub: "guardar sin nota" },
  ];
  const againOptions = (): ListItem[] => [
    { n: 1, label: "IGUAL", sub: "misma sede y profesional" },
    { n: 2, label: "NUEVO", sub: "empezar de cero" },
    { n: 3, label: "TERMINAR", sub: "salir del modo coche" },
  ];

  // ── Confirmación y guardado ──
  const confirmSummary = () => {
    const d = draftRef.current;
    const sedeName = sedes.find(s => s.id === d.sedeId)?.name || "";
    const proName = d.professionalId
      ? (() => { const p = professionals.find(x => x.id === d.professionalId); return p ? proLabel(p) : ""; })()
      : "toda la sede";
    return {
      spoken: [
        `El ${dateLabel(d.date)}`,
        `en ${sedeName}`,
        `para ${proName}`,
        turnPhrase(d.turn),
        d.note ? `nota: ${d.note}` : "",
      ].filter(Boolean).join(", "),
      parts: [
        d.date ? dateLabel(d.date) : "",
        sedeName,
        proName,
        turnPhrase(d.turn),
        d.note ? `📝 ${d.note}` : "",
      ].filter(Boolean),
    };
  };

  const askConfirm = () => {
    const { spoken, parts } = confirmSummary();
    setDraftField({}); // refresco visual
    gotoRef.current("confirm", {
      title: parts.join(" · "),
      say: `${spoken}. ¿Guardo? Di sí o no.`,
      echo: "",
    });
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
            reason: DEFAULT_REASON,
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
    if (!errMsg) {
      lastRef.current = { sedeId: d.sedeId, professionalId: d.professionalId, turn: d.turn };
    }
    onSaved();
    gotoRef.current("again", {
      title: errMsg ? `⚠️ No se pudo guardar: ${errMsg}` : "✅ Aviso guardado",
      say: errMsg ? `Atención: ${errMsg}. ¿Igual, nuevo, o terminar?` : "Guardado. ¿Igual, nuevo, o terminar?",
      items: againOptions(),
    });
  };

  // ── Reparto de respuestas por paso ──
  const handleAnswer = (raw: string) => {
    addLog(`🧑 ${raw}`);
    if (wantsStop(raw)) { void close("Modo manos libres terminado. ¡Hasta luego!"); return; }
    if (wantsRepeat(raw)) { askRef.current(stepRef.current, lastAskRef.current); return; }
    if (wantsCancel(raw) && stepRef.current !== "again" && stepRef.current !== "confirm") {
      draftRef.current = emptyDraft();
      setDraft(draftRef.current);
      skipSedeProTurnRef.current = false;
      gotoRef.current("again", {
        title: "Aviso cancelado",
        say: "Cancelado. ¿Igual, nuevo, o terminar?",
        items: againOptions(),
      });
      return;
    }

    switch (stepRef.current) {
      case "date": {
        // Si dice "día 15" o "15 de octubre" va directo al parser de fechas;
        // si dice un número suelto, es la opción de la lista en pantalla.
        const t = norm(raw);
        const wantsExplicitDate = /\b(dia|de)\b/.test(t);
        let date: string | null = null;
        if (!wantsExplicitDate) {
          const n = parseListNumber(raw, DATE_LIST_SIZE);
          if (n) date = upcomingDays(DATE_LIST_SIZE)[n - 1];
        }
        if (!date) date = parseDateAnswer(raw, contextYear, contextMonth);
        if (!date) {
          gotoRef.current("date", {
            title: "¿Qué día?",
            say: "No lo he pillado. Día: elige número de la lista, o di el día.",
            items: dateOptions(),
          });
          return;
        }
        setDraftField({ date });
        const keep = skipSedeProTurnRef.current && draftRef.current.sedeId;
        skipSedeProTurnRef.current = false;
        if (keep) {
          gotoRef.current("note", {
            title: "¿Quieres poner nota?",
            say: "¿Quieres poner nota? Di sí o no.",
            items: noteOptions(),
            echo: `El ${dateLabel(date)} · igual que antes`,
          });
          return;
        }
        if (draftRef.current.sedeId || sedes.length === 1) {
          if (sedes.length === 1 && !draftRef.current.sedeId) setDraftField({ sedeId: sedes[0].id });
          gotoPro(`El ${dateLabel(date)}`);
          return;
        }
        gotoRef.current("sede", {
          title: "¿Qué sede?",
          say: "Sede. Elige número.",
          items: sedeOptions(),
          echo: `El ${dateLabel(date)}`,
        });
        return;
      }
      case "sede": {
        const n = parseListNumber(raw, sedes.length);
        const id = n ? sedes[n - 1].id : matchSedeAnswer(raw, sedes);
        if (!id) {
          gotoRef.current("sede", {
            title: "¿Qué sede?",
            say: "No he entendido. Sede: elige número.",
            items: sedeOptions(),
          });
          return;
        }
        setDraftField({ sedeId: id });
        const name = sedes.find(s => s.id === id)?.name || "";
        gotoPro(`En ${name}`);
        return;
      }
      case "pro": {
        const maxN = professionals.length + 1;
        const n = parseListNumber(raw, maxN);
        let hit: { id: string; label: string } | null = null;
        if (n === maxN) hit = { id: "", label: "toda la sede" };
        else if (n) { const p = professionals[n - 1]; hit = { id: p.id, label: proLabel(p) }; }
        else hit = matchProAnswer(raw, professionals);
        if (!hit) {
          gotoRef.current("pro", {
            title: "¿Para quién?",
            say: "No he entendido. Profesional: elige número.",
            items: proOptions(),
          });
          return;
        }
        setDraftField({ professionalId: hit.id });
        gotoRef.current("turn", {
          title: "¿Qué turno?",
          say: "Turno: uno mañana, dos tarde, tres todo el día.",
          items: turnOptions(),
          echo: hit.id ? hit.label : "Toda la sede",
        });
        return;
      }
      case "turn": {
        const turn = parseTurnAnswer(raw);
        if (!turn) {
          gotoRef.current("turn", {
            title: "¿Qué turno?",
            say: "No he entendido. Uno mañana, dos tarde, tres todo el día.",
            items: turnOptions(),
          });
          return;
        }
        setDraftField({ turn });
        gotoRef.current("note", {
          title: "¿Quieres poner nota?",
          say: "¿Quieres poner nota? Di sí o no.",
          items: noteOptions(),
          echo: turnPhrase(turn),
        });
        return;
      }
      case "note": {
        // Estricto: solo sí o no (voz o número de lista). Nada de dictar aquí.
        let yn = parseYesNo(raw);
        if (yn === null) {
          const n = parseListNumber(raw, 2);
          yn = n === 1 ? true : n === 2 ? false : null;
        }
        if (yn === true) {
          gotoRef.current("noteText", { title: "Di la nota", say: "Dime la nota." });
          return;
        }
        if (yn === false) {
          setDraftField({ note: "" });
          askConfirm();
          return;
        }
        gotoRef.current("note", {
          title: "¿Quieres poner nota?",
          say: "No he entendido. ¿Quieres poner nota? Di sí o no.",
          items: noteOptions(),
        });
        return;
      }
      case "noteText": {
        // Nota libre en un paso; «sin nota» por si se arrepiente
        const t = norm(raw);
        if (/\b(sin nota|ninguna nota|salta|saltear)\b/.test(t)) setDraftField({ note: "" });
        else setDraftField({ note: raw.replace(/^nota[:\s]+/i, "").trim() });
        askConfirm();
        return;
      }
      case "confirm": {
        let yn = parseYesNo(raw);
        if (yn === null) {
          const n = parseListNumber(raw, 2);
          yn = n === 1 ? true : n === 2 ? false : null;
        }
        if (yn === true) { void save(); return; }
        if (yn === false) {
          draftRef.current = emptyDraft();
          setDraft(draftRef.current);
          gotoRef.current("again", {
            title: "Aviso descartado",
            say: "Descartado. ¿Igual, nuevo, o terminar?",
            items: againOptions(),
          });
          return;
        }
        askConfirm();
        return;
      }
      case "saving":
        return;
      case "again": {
        const t = norm(raw);
        const n = parseListNumber(raw, 3);
        if (n === 3) { void close("Hasta luego."); return; }
        if (n === 1 || /\b(igual|lo mismo|mismo)\b/.test(t)) {
          const last = lastRef.current;
          if (last) {
            draftRef.current = { ...emptyDraft(), sedeId: last.sedeId, professionalId: last.professionalId, turn: last.turn };
            setDraft(draftRef.current);
            skipSedeProTurnRef.current = true;
            const sName = sedes.find(s => s.id === last.sedeId)?.name || "";
            const pLabel = last.professionalId
              ? (() => { const p = professionals.find(x => x.id === last.professionalId); return p ? proLabel(p) : ""; })()
              : "toda la sede";
            gotoRef.current("date", {
              title: "¿Qué día?",
              say: "Igual que antes. Día: elige número.",
              items: dateOptions(),
              echo: `${sName} · ${pLabel} · ${turnPhrase(last.turn)}`,
            });
            return;
          }
          // sin aviso previo → flujo normal
          draftRef.current = emptyDraft();
          setDraft(draftRef.current);
          gotoRef.current("date", { title: "¿Qué día?", say: "Día: elige número.", items: dateOptions() });
          return;
        }
        if (n === 2 || wantsAnother(raw) || parseYesNo(raw) === true) {
          draftRef.current = emptyDraft();
          setDraft(draftRef.current);
          skipSedeProTurnRef.current = false;
          gotoRef.current("date", { title: "¿Qué día?", say: "Día: elige número.", items: dateOptions() });
          return;
        }
        gotoRef.current("again", {
          title: "¿Otro aviso?",
          say: "Di: igual, nuevo, o terminar.",
          items: againOptions(),
        });
        return;
      }
    }
  };
  handlerRef.current = handleAnswer;

  // Salto directo al paso profesional (con echo de la sede)
  function gotoPro(echo: string) {
    if (professionals.length === 0) {
      setDraftField({ professionalId: "" });
      gotoRef.current("turn", {
        title: "¿Qué turno?",
        say: "Turno: uno mañana, dos tarde, tres todo el día.",
        items: turnOptions(),
        echo,
      });
      return;
    }
    gotoRef.current("pro", {
      title: "¿Para quién?",
      say: "Profesional. Elige número.",
      items: proOptions(),
      echo,
    });
  }

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
      gotoRef.current("date", {
        title: "¿Qué día?",
        say: "Manos libres activado. Día: elige número de la lista.",
        items: dateOptions(),
      });
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
    note: "5 · ¿NOTA?",
    noteText: "5 · NOTA",
    confirm: "6 · CONFIRMAR",
    saving: "GUARDANDO…",
    again: "¿OTRO AVISO?",
  };

  const showList = items.length > 0 && !fatal;

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
      <div className="flex items-center justify-center gap-2 py-1.5 shrink-0">
        <span
          className={`h-3.5 w-3.5 rounded-full ${fatal ? "bg-red-500" : listening ? "bg-[#6BBE7A] animate-pulse" : "bg-amber-400"}`}
        />
        <span className="text-xs sm:text-sm font-black uppercase tracking-[3px] text-slate-400">
          {stepLabel[step]}
        </span>
        {echo && (
          <span className="ml-2 text-[10px] sm:text-xs font-bold text-[#6BBE7A] truncate max-w-[45vw]">{echo}</span>
        )}
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
        <div className="flex-1 flex flex-col min-h-0 px-3 sm:px-8 gap-2 max-w-3xl w-full mx-auto">
          {/* Pregunta / resumen actual */}
          <div className="bg-slate-900/70 border-2 border-[#6BBE7A]/40 rounded-2xl px-4 py-3 sm:py-4 text-center shrink-0">
            <p className={`font-black leading-snug text-white ${step === "confirm" ? "text-sm sm:text-lg" : "text-xl sm:text-3xl"}`}>
              {title}
            </p>
          </div>

          {/* Lo que se oye */}
          <div className="min-h-[2.2rem] flex items-center justify-center shrink-0">
            <p className={`text-base sm:text-xl font-bold text-center ${heard ? "text-amber-300 italic" : "text-slate-600"}`}>
              {heard ? `“${heard}”` : "…"}
            </p>
          </div>

          {/* Lista numerada en pantalla — el conductor solo dice el número */}
          {showList && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {items.map(it => (
                  <button
                    key={it.n}
                    onClick={() => handlerRef.current(String(it.n))}
                    className="flex items-center gap-3 bg-slate-800/80 hover:bg-slate-700 border border-slate-600 hover:border-[#6BBE7A] rounded-xl px-3 py-2.5 text-left active:scale-[0.98] transition"
                  >
                    <span className="shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-amber-500 text-black font-black text-lg sm:text-xl flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.4)]">
                      {it.n}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-black text-base sm:text-xl text-white truncate">{it.label}</span>
                      {it.sub && <span className="block text-[10px] sm:text-xs font-bold text-slate-400 truncate">{it.sub}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Confirmación: botones táctiles de apoyo */}
          {step === "confirm" && (
            <div className="flex gap-3 shrink-0 pt-1">
              <button
                onClick={() => handlerRef.current("sí")}
                className="flex-1 bg-[#2E5D3A] hover:bg-[#3a7a4c] border-2 border-[#6BBE7A] text-white font-black py-4 rounded-2xl text-lg shadow-[0_0_16px_rgba(107,190,122,0.35)] active:scale-95 transition"
              >
                ✔ GUARDAR
              </button>
              <button
                onClick={() => handlerRef.current("no")}
                className="flex-1 bg-red-600/70 hover:bg-red-600 border-2 border-red-400/60 text-white font-black py-4 rounded-2xl text-lg active:scale-95 transition"
              >
                ✕ NO
              </button>
            </div>
          )}

          {/* Borrador en curso */}
          <div className="bg-slate-900/50 border border-slate-700 rounded-2xl px-4 py-2.5 grid grid-cols-3 sm:grid-cols-5 gap-2 text-center shrink-0">
            <DraftCell label="Día" value={draft.date ? shortDateLabel(draft.date) : ""} />
            <DraftCell label="Sede" value={sedes.find(s => s.id === draft.sedeId)?.name || ""} />
            <DraftCell
              label="Quién"
              value={
                draft.professionalId
                  ? (() => { const p = professionals.find(x => x.id === draft.professionalId); return p ? p.alias : ""; })()
                  : draft.sedeId ? "Toda la sede" : ""
              }
            />
            <DraftCell label="Turno" value={draft.turn && draft.sedeId ? turnPhrase(draft.turn) : ""} />
            <DraftCell label="Nota" value={draft.note} />
          </div>

          {!showList && step !== "confirm" && step !== "saving" && (
            <div className="flex-1" />
          )}

          {/* Registro de la conversación */}
          <div className="h-14 sm:h-16 overflow-y-auto text-[10px] sm:text-xs text-slate-400 font-semibold space-y-0.5 shrink-0">
            {log.map((l, i) => (
              <p key={i} className={l.startsWith("🧑") ? "text-amber-300/90" : "text-slate-400"}>{l}</p>
            ))}
          </div>

          <p className="text-center text-[10px] sm:text-xs text-slate-500 font-bold shrink-0 pb-1">
            Di el <span className="text-amber-400">número</span> de la lista · «repite» reescucha · «cancela» reinicia · «terminar» sale
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
      <div className="text-[11px] sm:text-sm font-black text-slate-200 capitalize truncate">{value || "—"}</div>
    </div>
  );
}
