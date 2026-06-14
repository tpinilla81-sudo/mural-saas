"use client";

import { useState, useEffect, useRef } from "react";

export default function DiarioTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [sedes, setSedes] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [selectedPro, setSelectedPro] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function load() {
    const [sRes, pRes, plRes, hRes] = await Promise.all([
      fetch("/api/company/sedes"),
      fetch("/api/company/professionals"),
      fetch(`/api/company/plan?year=${year}`),
      fetch("/api/company/holidays"),
    ]);
    if (sRes.ok) setSedes(await sRes.json());
    if (pRes.ok) setProfessionals(await pRes.json());
    if (plRes.ok) setPlans(await plRes.json());
    if (hRes.ok) setHolidays(await hRes.json());
  }

  useEffect(() => { load(); }, [year]);

  const DOW = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];

  const daysArr: Date[] = [];
  const curr = new Date(year, 0, 1);
  while (curr.getFullYear() === year) { daysArr.push(new Date(curr)); curr.setDate(curr.getDate() + 1); }

  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const isWE = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  const isFestivo = (f: string, prov: string) => holidays.some(h => h.date === f && h.province === prov);
  const getPlan = (sedeId: string, date: string, turn: string) => plans.find(p => p.sedeId === sedeId && p.date === date && p.turn === turn);

  const filteredSedes = filters.length > 0 ? sedes.filter(s => filters.includes(s.color)) : sedes;

  const handleSlotClick = async (sedeId: string, date: string, turn: string) => {
    const existing = getPlan(sedeId, date, turn);
    if (existing) {
      if (confirm("¿Eliminar asignación?")) {
        await fetch(`/api/company/plan/${existing.id}`, { method: "DELETE" });
        load();
      }
      return;
    }
    if (!selectedPro) return;
    const sede = sedes.find(s => s.id === sedeId);
    if (isWE(new Date(date)) || isFestivo(date, sede?.province)) {
      if (!confirm("Es festivo/fin de semana. ¿Continuar?")) return;
    }
    await fetch("/api/company/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sedeId, date, turn, professionalAlias: selectedPro }),
    });
    load();
  };

  const uniqueColors = [...new Set(sedes.map(s => s.color))];

  return (
    <div className="flex flex-col h-full overflow-hidden border border-slate-700 rounded-xl bg-slate-800/50">
      <div className="bg-slate-900 p-4 border-b border-slate-700 flex gap-4 items-end flex-wrap shrink-0">
        <div>
          <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">AÑO</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-20 px-2 py-2 bg-slate-800 border border-slate-600 rounded text-white text-xs">
            {Array.from({ length: 15 }, (_, i) => 2026 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">PROFESIONAL</label>
          <select value={selectedPro} onChange={e => setSelectedPro(e.target.value)} className="w-64 px-2 py-2 bg-slate-800 border-2 border-amber-500 rounded text-white text-xs font-bold">
            <option value="">-- SELEC --</option>
            {professionals.map(p => <option key={p.id} value={p.alias}>{p.alias} - {p.firstName}</option>)}
          </select>
        </div>
        <div className="flex gap-2 ml-4">
          {uniqueColors.map(c => (
            <div key={c} onClick={() => setFilters(f => f.includes(c) ? f.filter(x => x !== c) : [...f, c])}
              className="w-5 h-5 rounded-full cursor-pointer" style={{ background: c, border: filters.includes(c) ? "2px solid white" : "1px solid #555" }} />
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto relative" ref={scrollRef}>
        <table className="border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 bg-black border-r-[3px] border-amber-500 px-3 py-2 text-xs text-blue-400 font-bold text-left w-[220px] min-w-[220px]">SEDES / TAREAS</th>
              {daysArr.map((d, i) => {
                const f = fmt(d);
                const isToday = f === fmt(new Date());
                return (
                  <th key={i} className={`${isToday ? "bg-amber-500 !text-black" : "bg-slate-900"} px-1 py-2 text-[9px] font-bold min-w-[70px] text-center border-b-2 border-slate-700`}>
                    {DOW[d.getDay()]}<br />{d.getDate()}/{d.getMonth() + 1}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredSedes.map(sede => (
              <tr key={sede.id}>
                <td className="sticky left-0 z-10 bg-black border-r-[3px] border-amber-500 px-3 py-2 border-b-2 border-white/90">
                  <div className="font-bold text-sm" style={{ borderLeft: `8px solid ${sede.color}`, paddingLeft: 8 }}>{sede.name}</div>
                  <div className="text-[10px] text-slate-400">{sede.task}</div>
                </td>
                {daysArr.map((d, i) => {
                  const f = fmt(d);
                  const we = isWE(d);
                  const fest = isFestivo(f, sede.province);
                  const planM = getPlan(sede.id, f, "MANANA");
                  const planT = getPlan(sede.id, f, "TARDE");
                  return (
                    <td key={i} className={`border-b-2 border-white/90 h-[60px] min-w-[70px] p-1 ${we ? "bg-purple-500/15" : ""} ${fest ? "bg-red-500/20" : ""}`}>
                      <div className="flex flex-col gap-1 items-center justify-center">
                        {sede.morningEnabled && (
                          <div onClick={() => handleSlotClick(sede.id, f, "MANANA")}
                            className={`h-6 w-[85%] rounded flex items-center justify-center text-[9px] font-bold cursor-pointer transition ${planM ? "text-black border border-white" : "text-white/20 border border-white/5"}`}
                            style={{ background: planM ? sede.color : "transparent", borderLeft: planM ? undefined : "3px solid #3b82f6" }}>
                            {planM?.professionalAlias || "M"}
                          </div>
                        )}
                        {sede.afternoonEnabled && (
                          <div onClick={() => handleSlotClick(sede.id, f, "TARDE")}
                            className={`h-6 w-[85%] rounded flex items-center justify-center text-[9px] font-bold cursor-pointer transition ${planT ? "text-black border border-white" : "text-white/20 border border-white/5"}`}
                            style={{ background: planT ? sede.color : "transparent", borderLeft: planT ? undefined : "3px solid #f59e0b" }}>
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
    </div>
  );
}
