"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import ProfesionalTab from "@/components/ProfesionalTab";
import SedesTab from "@/components/SedesTab";
import CalendariosTab from "@/components/CalendariosTab";
import DiarioTab from "@/components/DiarioTab";
import MensualTab from "@/components/MensualTab";

export default function CompanyDashboard() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<"pros" | "sedes" | "cal" | "diario" | "mensual">("mensual");

  const tabs = [
    { key: "pros" as const, label: "👷 PROFESIONALES" },
    { key: "sedes" as const, label: "🏢 SEDES" },
    { key: "cal" as const, label: "🗓️ CALENDARIOS" },
    { key: "diario" as const, label: "📅 DIARIO" },
    { key: "mensual" as const, label: "📆 MENSUAL" },
  ];

  return (
    <div className="h-full flex flex-col p-5 overflow-hidden">
      <div className="flex gap-3 mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition ${
              tab === t.key ? "bg-amber-500 text-black" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === "pros" && <ProfesionalTab />}
        {tab === "sedes" && <SedesTab />}
        {tab === "cal" && <CalendariosTab />}
        {tab === "diario" && <DiarioTab />}
        {tab === "mensual" && <MensualTab />}
      </div>
    </div>
  );
}
