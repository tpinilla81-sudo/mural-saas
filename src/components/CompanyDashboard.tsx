"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import ProfesionalTab from "@/components/ProfesionalTab";
import SedesTab from "@/components/SedesTab";
import CalendariosTab from "@/components/CalendariosTab";
import DiarioTab from "@/components/DiarioTab";
import MensualTab from "@/components/MensualTab";
import CompanyProfileTab from "@/components/CompanyProfileTab";

type MainTab = "empresa" | "diario";
type DiarioSubTab = "sedes" | "pros" | "cal" | "diario" | "mensual";

export default function CompanyDashboard() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<MainTab>("diario");
  const [diarioSub, setDiarioSub] = useState<DiarioSubTab>("diario");

  const mainTabs: { key: MainTab; label: string; icon: string }[] = [
    { key: "empresa", label: "MI EMPRESA", icon: "🏢" },
    { key: "diario", label: "DIARIO", icon: "📅" },
  ];

  const diarioSubs: { key: DiarioSubTab; label: string }[] = [
    { key: "sedes", label: "Sedes" },
    { key: "pros", label: "Profesionales" },
    { key: "cal", label: "Calendarios" },
    { key: "diario", label: "Diario" },
    { key: "mensual", label: "Mensual" },
  ];

  return (
    <div className="h-full flex flex-col p-3 sm:p-5 overflow-hidden">
      {/* Main tabs - mobile friendly */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 shrink-0">
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
      </div>

      <div className="flex-1 overflow-auto">
        {/* ═══════ MI EMPRESA ═══════ */}
        {tab === "empresa" && <CompanyProfileTab />}

        {/* ═══════ DIARIO ═══════ */}
        {tab === "diario" && (
          <div className="space-y-3">
            {/* Sub-tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
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

            <div className="flex-1">
              {diarioSub === "sedes" && <SedesTab />}
              {diarioSub === "pros" && <ProfesionalTab />}
              {diarioSub === "cal" && <CalendariosTab />}
              {diarioSub === "diario" && <DiarioTab />}
              {diarioSub === "mensual" && <MensualTab />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
