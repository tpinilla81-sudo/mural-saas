"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceAvisoModal } from "@/components/VoiceAvisoButton";
import HandsFreeOverlay from "@/components/HandsFreeOverlay";

// ═══════════════════════════════════════════════════════════════
// MODO COCHE — pantalla para móvil/tablet en el soporte del coche
// Gigante, contraste alto, manejo por voz. (CarPlay/Android Auto
// no admiten apps de gestión, pero esta pantalla instalada como
// app cumple la misma función con el móvil en el salpicadero.)
// ═══════════════════════════════════════════════════════════════

interface AvisoRow {
  id: string;
  date: string;
  turn: string;
  reason: string;
  note: string;
  professional?: { firstName: string; lastName: string; alias: string } | null;
  sede?: { name: string } | null;
}

const REASON_STYLES: Record<string, string> = {
  VACACIONES: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  BAJA: "bg-red-500/20 text-red-300 border-red-500/40",
  FORMACION: "bg-sky-500/20 text-sky-300 border-sky-500/40",
  PERMISO: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  AUSENCIA: "bg-slate-500/25 text-slate-300 border-slate-400/40",
};

function CarScreen() {
  const { status } = useSession();
  const [avisos, setAvisos] = useState<AvisoRow[]>([]);
  const [sedes, setSedes] = useState<{ id: string; name: string }[]>([]);
  const [pros, setPros] = useState<{ id: string; alias: string; firstName: string; lastName: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [handsFreeOpen, setHandsFreeOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);

  // Redirect al login si no hay sesión
  useEffect(() => {
    if (status === "unauthenticated") window.location.href = "/";
  }, [status]);

  // Reloj (tick cada 20 s)
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(t);
  }, []);

  // Wake lock: mantiene la pantalla encendida (mejor esfuerzo)
  useEffect(() => {
    const acquire = async () => {
      try {
        const nav = navigator as any;
        if (nav.wakeLock?.request) {
          wakeRef.current = await nav.wakeLock.request("screen");
        }
      } catch {
        /* no soportado o denegado: continuar sin lock */
      }
    };
    acquire();
    const onVis = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      try {
        wakeRef.current?.release();
      } catch {}
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const [a, s, p] = await Promise.all([
        fetch("/api/company/avisos").then(r => (r.ok ? r.json() : [])),
        fetch("/api/company/sedes").then(r => (r.ok ? r.json() : [])),
        fetch("/api/company/professionals").then(r => (r.ok ? r.json() : [])),
      ]);
      setAvisos(Array.isArray(a) ? a : []);
      setSedes(Array.isArray(s) ? s : []);
      setPros(Array.isArray(p) ? p : []);
    } catch {
      /* sin conexión: mantener lo último */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  if (status !== "authenticated") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b1120]">
        <div className="h-14 w-14 rounded-full border-2 border-slate-600 border-t-slate-300 animate-spin" />
      </div>
    );
  }

  const current = now ?? new Date();
  const todayStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}-${String(
    current.getDate()
  ).padStart(2, "0")}`;

  const timeStr = current.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const dateStr = current.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const todayAvisos = avisos
    .filter(a => a.date === todayStr)
    .sort((a, b) => a.turn.localeCompare(b.turn));

  return (
    <div
      className="min-h-[100dvh] bg-[#0b1120] text-slate-100 flex flex-col"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* ── Barra superior ── */}
      <header className="flex items-center gap-2 px-3 sm:px-5 shrink-0">
        <img src="/mural-logo.png" alt="MURAL" className="h-8 bg-white rounded-md px-1 shadow" />
        <div className="leading-none">
          <span className="text-amber-500 font-black text-sm">MURAL</span>
          <small className="block text-slate-400 text-[8px] font-bold tracking-[2px]">PLASTIC SURGERY</small>
        </div>
        <span className="ml-2 text-[10px] sm:text-xs font-black uppercase tracking-widest text-[#6BBE7A] border border-[#6BBE7A]/40 rounded-full px-2 py-0.5">
          Modo coche
        </span>
        <button
          onClick={() => (window.location.href = "/")}
          className="ml-auto bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold px-3 py-1.5 rounded-lg text-xs transition"
        >
          ← App completa
        </button>
      </header>

      {/* ── Cuerpo: retrato en columna, apaisado en 2 columnas ── */}
      <div className="flex-1 grid grid-cols-1 landscape:grid-cols-[1.1fr_1fr] gap-3 p-3 sm:p-5 min-h-0">
        {/* Columna izquierda: reloj + micrófono */}
        <section className="flex flex-col items-center justify-center gap-4 sm:gap-6 min-h-0">
          <div className="text-center select-none">
            <div className="text-7xl sm:text-8xl font-black tracking-tight tabular-nums text-white leading-none">
              {timeStr}
            </div>
            <div className="text-base sm:text-xl font-bold text-[#6BBE7A] capitalize mt-2">{dateStr}</div>
          </div>

          <button
            onClick={() => setVoiceOpen(true)}
            disabled={!loaded || sedes.length === 0}
            className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-b from-[#3a7a4c] to-[#2E5D3A] ring-8 ring-[#6BBE7A]/25 active:scale-95 disabled:opacity-40 flex items-center justify-center text-6xl sm:text-7xl shadow-2xl transition-transform select-none"
            title="Audio Modo PC: dictado libre en una frase"
          >
            🎙️
          </button>
          <div className="text-center -mt-1">
            <div className="text-lg sm:text-2xl font-black text-white tracking-wide">
              {loaded && sedes.length === 0 ? "SIN SEDES CARGADAS" : "AUDIO MODO PC"}
            </div>
            <p className="text-[11px] sm:text-sm text-slate-400 font-bold mt-1 max-w-xs mx-auto">
              Dictado libre: pulsa y di «el día 15 en Vitoria, Julio, vacaciones, nota: se va de viaje»
            </p>
          </div>

          {/* Manos libres: diálogo 100% por voz, sin tocar la pantalla */}
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={() => setHandsFreeOpen(true)}
              disabled={!loaded || sedes.length === 0}
              className="w-64 max-w-full bg-slate-900/70 border-2 border-amber-500 text-amber-400 hover:bg-amber-600/30 hover:text-white active:scale-[0.98] disabled:opacity-40 font-black py-3 rounded-2xl text-lg shadow-lg transition"
              title="Audio Modo Coche: la app pregunta por voz y tú respondes sin mirar"
            >
              🔊 AUDIO MODO COCHE
            </button>
            <p className="text-[10px] sm:text-xs text-slate-500 font-bold text-center max-w-[16rem]">
              Para conducir: la app pregunta por voz y tú solo hablas — 100% manos libres
            </p>
          </div>
        </section>

        {/* Columna derecha: avisos de hoy */}
        <section className="flex flex-col min-h-0 gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <h2 className="text-sm sm:text-lg font-black uppercase tracking-widest text-slate-300">
              Avisos de hoy
            </h2>
            <span className="bg-[#6BBE7A] text-[#0b1120] font-black text-xs sm:text-sm rounded-full px-2.5 py-0.5">
              {todayAvisos.length}
            </span>
            <button
              onClick={load}
              className="ml-auto text-slate-400 hover:text-white text-lg px-2 transition"
              title="Actualizar"
            >
              ⟳
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
            {todayAvisos.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 border border-dashed border-slate-700 rounded-2xl p-6">
                <span className="text-4xl">✅</span>
                <p className="text-slate-400 font-bold text-sm sm:text-base">
                  {loaded ? "Sin avisos para hoy" : "Cargando avisos…"}
                </p>
              </div>
            )}
            {todayAvisos.map(a => {
              const pro = a.professional
                ? `${a.professional.firstName} ${a.professional.lastName}`.trim()
                : null;
              const reasonStyle = REASON_STYLES[a.reason] || REASON_STYLES.AUSENCIA;
              return (
                <article
                  key={a.id}
                  className="bg-slate-900/80 border border-slate-700 rounded-2xl p-3.5 sm:p-4 shadow-lg"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-black text-[10px] sm:text-xs tracking-wider rounded-md px-2 py-1 ${
                        a.turn === "M" ? "bg-sky-500/20 text-sky-300" : "bg-orange-500/20 text-orange-300"
                      }`}
                    >
                      {a.turn === "M" ? "MAÑANA" : "TARDE"}
                    </span>
                    <span className={`font-black text-[10px] sm:text-xs tracking-wider rounded-md px-2 py-1 border ${reasonStyle}`}>
                      {a.reason}
                    </span>
                  </div>
                  <div className="mt-1.5 text-xl sm:text-3xl font-black text-white leading-tight">
                    {pro || "🏥 Sede completa"}
                  </div>
                  <div className="text-sm sm:text-lg font-bold text-slate-400">
                    {a.sede?.name || ""}
                  </div>
                  {a.note && (
                    <div className="mt-2 flex items-start gap-1.5 bg-slate-800/70 border-l-4 border-amber-500 rounded-r-lg px-2.5 py-1.5">
                      <span className="text-sm">📝</span>
                      <p className="text-xs sm:text-sm text-amber-200 font-semibold whitespace-pre-wrap">
                        {a.note}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {voiceOpen && (
        <VoiceAvisoModal
          onClose={() => setVoiceOpen(false)}
          onSaved={load}
          sedes={sedes}
          professionals={pros}
          contextYear={current.getFullYear()}
          contextMonth={current.getMonth()}
        />
      )}

      {handsFreeOpen && (
        <HandsFreeOverlay
          onClose={() => setHandsFreeOpen(false)}
          onSaved={load}
          sedes={sedes}
          professionals={pros}
          contextYear={current.getFullYear()}
          contextMonth={current.getMonth()}
        />
      )}
    </div>
  );
}

export default function CochePage() {
  return (
    <SessionProvider>
      <CarScreen />
    </SessionProvider>
  );
}
