"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

// Permission keys (mirrors server-side CSV in User.permissions)
type Perms = {
  view_diario: boolean;
  view_mensual: boolean;
  view_own_only: boolean;
  view_assigned_sedes: boolean;
};

function parsePerms(csv?: string): Perms {
  const set = new Set((csv || "").split(",").map(s => s.trim()).filter(Boolean));
  return {
    view_diario: set.has("view_diario"),
    view_mensual: set.has("view_mensual"),
    view_own_only: set.has("view_own_only"),
    view_assigned_sedes: set.has("view_assigned_sedes"),
  };
}

interface MyPro {
  id: string;
  alias: string;
  assignedSedes: string; // CSV of sede names
}

export default function UserView() {
  const { data: session } = useSession();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [plans, setPlans] = useState<any[]>([]);
  const [sedes, setSedes] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [myPro, setMyPro] = useState<MyPro | null>(null);
  const [view, setView] = useState<"mensual" | "diario">("mensual");

  const perms = parsePerms((session?.user as any)?.permissions);
  const professionalId = (session?.user as any)?.professionalId as string | undefined;

  async function load() {
    const [plRes, sRes, hRes] = await Promise.all([
      fetch(`/api/company/plan?year=${year}&month=${month}`),
      fetch("/api/company/sedes"),
      fetch("/api/company/holidays"),
    ]);
    if (plRes.ok) setPlans(await plRes.json());
    if (sRes.ok) setSedes(await sRes.json());
    if (hRes.ok) setHolidays(await hRes.json());

    // If the user has a linked professional, fetch it to know alias + assigned sedes
    if (professionalId) {
      try {
        const r = await fetch("/api/company/professionals");
        if (r.ok) {
          const all = await r.json();
          const me = all.find((p: any) => p.id === professionalId);
          if (me) setMyPro({ id: me.id, alias: me.alias, assignedSedes: me.assignedSedes || "" });
        }
      } catch { /* ignore */ }
    }
  }

  useEffect(() => { load(); }, [year, month, professionalId]);

  // Default view based on perms
  useEffect(() => {
    if (perms.view_diario && !perms.view_mensual) setView("diario");
    else setView("mensual");
  }, [(session?.user as any)?.permissions]);

  // Apply filters
  const filteredPlans = plans.filter((p: any) => {
    // "Solo sus turnos": only show plans where the assigned pro matches my alias
    if (perms.view_own_only && myPro) {
      if (p.professionalAlias !== myPro.alias) return false;
    }
    // "Solo sus sedes": only show plans in sedes listed in my assignedSedes
    if (perms.view_assigned_sedes && myPro) {
      const sede = sedes.find((s: any) => s.id === p.sedeId);
      if (!sede) return false;
      const mySedes = (myPro.assignedSedes || "")
        .split(",")
        .map((s: string) => s.trim().toUpperCase())
        .filter(Boolean);
      if (!mySedes.includes((sede.name || "").toUpperCase())) return false;
    }
    return true;
  });

  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const DOW_HEADER = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];

  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const isWE = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

  const textColorFor = (hex: string) => {
    if (!hex) return "#000";
    hex = hex.replace("#", "");
    const num = parseInt(hex, 16);
    const r = (num >> 16) & 255, g = (num >> 8) & 255, b = num & 255;
    return ((r * 299 + g * 587 + b * 114) / 1000) >= 140 ? "#000" : "#fff";
  };

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startWeekday = firstDay.getDay();
  startWeekday = startWeekday === 0 ? 6 : startWeekday - 1;
  const totalDays = lastDay.getDate();

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(<td key={`e${i}`} className="border border-gray-300 bg-gray-100 h-[110px]" />);

  for (let day = 1; day <= totalDays; day++) {
    const dateObj = new Date(year, month, day);
    const f = fmt(dateObj);
    const we = isWE(dateObj);
    const festProvs = new Set<string>();
    sedes.forEach(s => { if (holidays.some(h => h.date === f && h.province === s.province)) festProvs.add(s.province); });
    const fest = festProvs.size > 0;

    const dayPlans = filteredPlans.filter((p: any) => p.date === f);
    const assigns = dayPlans.map((p: any) => {
      const sede = sedes.find((s: any) => s.id === p.sedeId);
      const turnLabel = p.turn === "MANANA" ? "M" : "T";
      return (
        <div key={p.id} className="text-[9px] px-1 py-0.5 rounded font-bold leading-tight border border-black/10"
          style={{ background: sede?.color || "#94a3b8", color: textColorFor(sede?.color || "#94a3b8") }}>
          <span className="inline-block font-black px-0.5 mr-0.5 bg-black/80 text-white rounded-[2px]">{turnLabel}</span>
          {sede?.name} / {sede?.task}
        </div>
      );
    });

    const tdClass = fest ? "bg-red-100" : we ? "bg-purple-50" : "bg-gray-50";
    cells.push(
      <td key={day} className={`border border-gray-300 h-[110px] p-1 align-top ${tdClass}`}>
        <div className="font-black text-[13px] text-gray-900 flex justify-between items-center">
          <span>{day}</span>
          {fest && <span className="text-[8px] font-black bg-red-700 text-white px-1 py-0.5 rounded">FESTIVO</span>}
        </div>
        <div className="flex flex-col gap-0.5 mt-1">{assigns}</div>
      </td>
    );
  }
  while (cells.length % 7 !== 0) cells.push(<td key={`te${cells.length}`} className="border border-gray-300 bg-gray-100" />);

  const rows: React.ReactNode[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(<tr key={i}>{cells.slice(i, i + 7)}</tr>);

  // ─── Daily view (read-only) ───
  const DOW = ["D", "L", "M", "X", "J", "V", "S"];
  const daysArr: Date[] = [];
  const curr = new Date(year, month, 1);
  while (curr.getMonth() === month) { daysArr.push(new Date(curr)); curr.setDate(curr.getDate() + 1); }

  const todayStr = fmt(new Date());

  const diarioRows = sedes
    .filter((s: any) => {
      // "Solo sus sedes": hide sedes not in my assignedSedes
      if (perms.view_assigned_sedes && myPro) {
        const mySedes = (myPro.assignedSedes || "").split(",").map((x: string) => x.trim().toUpperCase()).filter(Boolean);
        if (!mySedes.includes((s.name || "").toUpperCase())) return false;
      }
      return true;
    })
    .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

  return (
    <div className="flex flex-col h-full p-3 sm:p-5 overflow-hidden">
      {/* Top bar: year/month + view switch (if both perms) */}
      <div className="flex gap-2 sm:gap-4 items-end mb-3 shrink-0 flex-wrap">
        <div>
          <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">AÑO</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-20 sm:w-24 px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs">
            {Array.from({ length: 15 }, (_, i) => 2026 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">MES</label>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="w-28 sm:w-32 px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs">
            {MESES.map((m, i) => <option key={i} value={i}>{m.toUpperCase()}</option>)}
          </select>
        </div>
        {perms.view_diario && perms.view_mensual && (
          <div className="flex gap-1">
            <button onClick={() => setView("mensual")}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition ${view === "mensual" ? "bg-[#6BBE7A] text-black" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
              Mensual
            </button>
            <button onClick={() => setView("diario")}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition ${view === "diario" ? "bg-[#6BBE7A] text-black" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
              Diario
            </button>
          </div>
        )}
        {myPro && (
          <div className="ml-auto text-right">
            <div className="text-xs text-slate-400">Hola,</div>
            <div className="text-sm font-bold text-amber-400">{myPro.alias}</div>
          </div>
        )}
      </div>

      {/* Mensual view */}
      {view === "mensual" && (
        <div className="flex-1 overflow-auto bg-white text-gray-900 rounded-xl p-3 sm:p-5">
          <h1 className="text-lg sm:text-xl font-black mb-3 border-b-[3px] border-gray-900 pb-2">{MESES[month].toUpperCase()} {year}</h1>
          <table className="w-full border-collapse table-fixed">
            <thead>
              <tr>{DOW_HEADER.map((d, i) => <th key={i} className={`py-2 text-[10px] sm:text-[11px] font-bold text-center border border-gray-900 ${i >= 5 ? "bg-purple-900" : "bg-gray-900"}`} style={{ color: "#fff" }}>{d}</th>)}</tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
          {filteredPlans.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-6">
              No tienes turnos asignados en este mes.
            </div>
          )}
        </div>
      )}

      {/* Diario view (read-only) */}
      {view === "diario" && (
        <div className="flex-1 overflow-auto bg-slate-800/30 rounded-xl border border-slate-700">
          <table className="border-collapse w-full">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-20 bg-black border-r-[3px] border-amber-500 px-2 py-2 text-[10px] sm:text-xs text-blue-400 font-bold text-left">
                  SEDES
                </th>
                {daysArr.map((d, i) => {
                  const f = fmt(d);
                  const isToday = f === todayStr;
                  return (
                    <th key={i}
                      className={`${isToday ? "bg-amber-500 !text-black" : "bg-slate-900"} min-w-[36px] sm:min-w-[50px] px-0 py-2 text-[8px] sm:text-[10px] font-bold text-center border-b-2 border-slate-700`}>
                      {DOW[d.getDay()]}<br />{d.getDate()}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {diarioRows.length === 0 && (
                <tr>
                  <td colSpan={daysArr.length + 1} className="text-center text-slate-500 text-sm py-8">
                    No tienes sedes asignadas.
                  </td>
                </tr>
              )}
              {diarioRows.map((sede: any) => (
                <tr key={sede.id}>
                  <td className="sticky left-0 z-10 bg-black border-r-[3px] border-amber-500 px-2 py-1 border-b-2 border-white/90">
                    <div className="font-bold text-xs sm:text-sm" style={{ borderLeft: `6px solid ${sede.color}`, paddingLeft: 6 }}>{sede.name}</div>
                    <div className="text-[9px] text-slate-400">{sede.task}</div>
                  </td>
                  {daysArr.map((d, i) => {
                    const f = fmt(d);
                    const we = isWE(d);
                    const fest = holidays.some((h: any) => h.date === f && h.province === sede.province);
                    const planM = filteredPlans.find((p: any) => p.sedeId === sede.id && p.date === f && p.turn === "MANANA");
                    const planT = filteredPlans.find((p: any) => p.sedeId === sede.id && p.date === f && p.turn === "TARDE");
                    return (
                      <td key={i} className={`border-b-2 border-white/90 h-[44px] min-w-[36px] sm:min-w-[50px] p-0.5 sm:p-1 text-center ${we ? "bg-purple-500/15" : ""} ${fest ? "bg-red-500/20" : ""}`}>
                        <div className="flex flex-col gap-0.5 items-center justify-center h-full">
                          {sede.morningEnabled && (
                            <div
                              className="h-5 sm:h-6 w-[85%] rounded flex items-center justify-center text-[7px] sm:text-[9px] font-bold"
                              style={{ background: planM ? sede.color : "transparent", color: planM ? textColorFor(sede.color) : "rgba(255,255,255,0.2)", border: planM ? "1px solid white" : "1px solid rgba(255,255,255,0.05)" }}
                            >
                              {planM?.professionalAlias || "M"}
                            </div>
                          )}
                          {sede.afternoonEnabled && (
                            <div
                              className="h-5 sm:h-6 w-[85%] rounded flex items-center justify-center text-[7px] sm:text-[9px] font-bold"
                              style={{ background: planT ? sede.color : "transparent", color: planT ? textColorFor(sede.color) : "rgba(255,255,255,0.2)", border: planT ? "1px solid white" : "1px solid rgba(255,255,255,0.05)" }}
                            >
                              {planT?.professionalAlias || "T"}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
