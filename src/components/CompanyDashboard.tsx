"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import ProfesionalTab from "@/components/ProfesionalTab";
import SedesTab from "@/components/SedesTab";
import CalendariosTab from "@/components/CalendariosTab";
import DiarioTab from "@/components/DiarioTab";
import MensualTab from "@/components/MensualTab";
import CompanyProfileTab from "@/components/CompanyProfileTab";
import ConfigTab from "@/components/ConfigTab";
import { VoiceAvisoModal } from "@/components/VoiceAvisoButton";
import HandsFreeOverlay from "@/components/HandsFreeOverlay";

type MainTab = "empresa" | "diario" | "config";
type DiarioSubTab = "sedes" | "pros" | "cal" | "diario" | "mensual";

interface SedeLike { id: string; name: string; city?: string; task?: string }
interface ProLike { id: string; alias: string; firstName: string; lastName: string }

export default function CompanyDashboard() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<MainTab>("diario");
  const [diarioSub, setDiarioSub] = useState<DiarioSubTab>("diario");

  // Datos para los botones de voz de la barra principal (sedes + profesionales).
  // Los tabs internos cargan los suyos; estos alimentan los overlays globales.
  const [sedes, setSedes] = useState<SedeLike[]>([]);
  const [pros, setPros] = useState<ProLike[]>([]);
  const [voiceCarOpen, setVoiceCarOpen] = useState(false);
  const [voicePcOpen, setVoicePcOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/company/sedes").then(r => (r.ok ? r.json() : [])),
      fetch("/api/company/professionals").then(r => (r.ok ? r.json() : [])),
    ]).then(([s, p]) => {
      if (!alive) return;
      setSedes(Array.isArray(s) ? s : []);
      setPros(Array.isArray(p) ? p : []);
    }).catch(() => { /* sin conexión: los tabs internos reintentan */ });
    return () => { alive = false; };
  }, []);

  const mainTabs: { key: MainTab; label: string; icon: string }[] = [
    { key: "empresa", label: "MI EMPRESA", icon: "🏢" },
    { key: "diario", label: "DIARIO", icon: "📅" },
    { key: "config", label: "CONFIGURACIÓN", icon: "⚙️" },
  ];

  const diarioSubs: { key: DiarioSubTab; label: string }[] = [
    { key: "sedes", label: "Sedes" },
    { key: "pros", label: "Profesionales" },
    { key: "cal", label: "Calendarios" },
    { key: "diario", label: "Diario" },
    { key: "mensual", label: "Mensual" },
  ];

  const now = new Date();

  return (
    <div className="h-full flex flex-col p-3 sm:p-5 overflow-hidden">
      {/* Main tabs - mobile friendly */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 shrink-0 items-center">
        {mainTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition whitespace-nowrap ${
              tab === t.key ? "bg-[#2E5D3A] text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
            }`}
          >
            <span className="sm:hidden">{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden ml-1">{t.label.split(' ')[0]}</span>
          </button>
        ))}

        {/* ── Botones de voz globales: a la derecha, resaltados — SOLO en la pestaña DIARIO ── */}
        {tab === "diario" && (
        <div className="ml-auto flex gap-2 shrink-0 pl-2">
          <button
            onClick={() => setVoiceCarOpen(true)}
            disabled={sedes.length === 0}
            className="bg-gradient-to-b from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-black font-black px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-base shadow-[0_0_18px_rgba(245,158,11,0.5)] active:scale-95 transition flex items-center gap-1.5 whitespace-nowrap"
            title="Modo Coche: la app pregunta por voz y tú respondes sin tocar la pantalla"
          >
            🔊<span className="hidden sm:inline"> MODO COCHE</span><span className="sm:hidden"> Coche</span>
          </button>
          <button
            onClick={() => setVoicePcOpen(true)}
            disabled={sedes.length === 0}
            className="bg-gradient-to-b from-[#3a7a4c] to-[#2E5D3A] hover:from-[#4a9a60] hover:to-[#3a7a4c] disabled:opacity-40 text-white font-black px-3 sm:px-5 py-2 rounded-xl text-xs sm:text-base shadow-[0_0_18px_rgba(107,190,122,0.5)] ring-2 ring-[#6BBE7A]/50 active:scale-95 transition flex items-center gap-1.5 whitespace-nowrap"
            title="Modo PC: dictado libre en una frase con vista previa editable"
          >
            🎙️<span className="hidden sm:inline"> MODO PC</span><span className="sm:hidden"> PC</span>
          </button>
        </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {/* ═══════ MI EMPRESA ═══════ */}
        {tab === "empresa" && <CompanyProfileTab />}

        {/* ═══════ CONFIGURACIÓN ═══════ */}
        {tab === "config" && <ConfigTab />}

        {/* ═══════ DIARIO ═══════ */}
        {tab === "diario" && (
          <div className="h-full flex flex-col space-y-3 min-h-0">
            {/* Sub-tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 shrink-0">
              {diarioSubs.map(s => (
                <button
                  key={s.key}
                  onClick={() => setDiarioSub(s.key)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition whitespace-nowrap ${
                    diarioSub === s.key ? "bg-[#6BBE7A] text-black" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className={`flex-1 min-h-0 ${diarioSub === "diario" || diarioSub === "mensual" ? "" : "overflow-auto pr-1"}`}>
              {diarioSub === "sedes" && <SedesTab />}
              {diarioSub === "pros" && <ProfesionalTab />}
              {diarioSub === "cal" && <CalendariosTab />}
              {diarioSub === "diario" && <DiarioTab />}
              {diarioSub === "mensual" && <MensualTab />}
            </div>
          </div>
        )}
      </div>

      {/* ── Overlays de voz globales (abren desde cualquier pestaña) ── */}
      {voiceCarOpen && (
        <HandsFreeOverlay
          onClose={() => setVoiceCarOpen(false)}
          onSaved={() => { /* los tabs recargan al montarse */ }}
          sedes={sedes}
          professionals={pros}
          contextYear={now.getFullYear()}
          contextMonth={now.getMonth()}
        />
      )}
      {voicePcOpen && (
        <VoiceAvisoModal
          onClose={() => setVoicePcOpen(false)}
          onSaved={() => { /* los tabs recargan al montarse */ }}
          sedes={sedes}
          professionals={pros}
          contextYear={now.getFullYear()}
          contextMonth={now.getMonth()}
        />
      )}
    </div>
  );
}
