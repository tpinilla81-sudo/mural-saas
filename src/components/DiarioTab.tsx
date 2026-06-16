"use client";

import { useState, useEffect, useRef } from "react";

export default function DiarioTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [sedes, setSedes] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [avisos, setAvisos] = useState<any[]>([]);
  const [selectedPro, setSelectedPro] = useState("");
  const [filters, setFilters] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLTableCellElement>(null);

  async function load() {
    const [sRes, pRes, plRes, hRes, aRes] = await Promise.all([
      fetch("/api/company/sedes"),
      fetch("/api/company/professionals"),
      fetch(`/api/company/plan?year=${year}`),
      fetch("/api/company/holidays"),
      fetch("/api/company/avisos"),
    ]);
    if (sRes.ok) setSedes(await sRes.json());
    if (pRes.ok) setProfessionals(await pRes.json());
    if (plRes.ok) setPlans(await plRes.json());
    if (hRes.ok) setHolidays(await hRes.json());
    if (aRes.ok) setAvisos(await aRes.json());
  }

  useEffect(() => { load(); }, [year]);

  // Auto-scroll to today after load
  useEffect(() => {
    setTimeout(() => {
      if (todayRef.current && scrollRef.current) {
        const container = scrollRef.current;
        const cell = todayRef.current;
        const left = cell.offsetLeft - container.clientWidth / 3;
        container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
      }
    }, 300);
  }, [plans, sedes]);

  const DOW = ["D", "L", "M", "X", "J", "V", "S"];

  const daysArr: Date[] = [];
  const curr = new Date(year, 0, 1);
  while (curr.getFullYear() === year) { daysArr.push(new Date(curr)); curr.setDate(curr.getDate() + 1); }

  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const todayStr = fmt(new Date());
  const isWE = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
  const isFestivo = (f: string, prov: string) => holidays.some(h => h.date === f && h.province === prov);
  const getPlan = (sedeId: string, date: string, turn: string) => plans.find(p => p.sedeId === sedeId && p.date === date && p.turn === turn);
  const getAviso = (sedeId: string, date: string, turn: string) => {
    const t = turn === "MANANA" ? "M" : "T";
    return avisos.find(a => a.sedeId === sedeId && a.date === date && a.turn === t);
  };

  const filteredSedes = filters.length > 0 ? sedes.filter(s => filters.includes(s.color)) : sedes;

  const scrollToToday = () => {
    if (todayRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const cell = todayRef.current;
      const left = cell.offsetLeft - container.clientWidth / 3;
      container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
  };

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

  const handleAvisoClick = async (sedeId: string, date: string, turn: string) => {
    const existing = getAviso(sedeId, date, turn);
    if (existing) {
      if (confirm("¿Eliminar aviso?")) {
        await fetch(`/api/company/avisos/${existing.id}`, { method: "DELETE" });
        load();
      }
      return;
    }
    if (!selectedPro) {
      alert("Selecciona un profesional primero");
      return;
    }
    const pro = professionals.find(p => p.alias === selectedPro);
    if (!pro) return;
    const t = turn === "MANANA" ? "M" : "T";
    await fetch("/api/company/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, professionalId: pro.id, sedeId, turn: t }),
    });
    load();
  };

  const uniqueColors = [...new Set(sedes.map(s => s.color))];

  return (
    <div className="flex flex-col h-full overflow-hidden border border-slate-700 rounded-xl bg-slate-800/50">
      {/* Toolbar */}
      <div className="bg-slate-900 p-2 sm:p-3 border-b border-slate-700 shrink-0">
        <div className="flex gap-2 sm:gap-3 items-end flex-wrap">
          <div>
            <label className="block text-[10px] sm:text-xs font-extrabold text-blue-400 uppercase mb-1">AÑO</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-16 sm:w-20 px-1.5 sm:px-2 py-1.5 sm:py-2 bg-slate-800 border border-slate-600 rounded text-white text-xs">
              {Array.from({ length: 15 }, (_, i) => 2026 + i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[140px] sm:min-w-0 sm:flex-none">
            <label className="block text-[10px] sm:text-xs font-extrabold text-blue-400 uppercase mb-1">PROFESIONAL</label>
            <select value={selectedPro} onChange={e => setSelectedPro(e.target.value)} className="w-full sm:w-56 px-1.5 sm:px-2 py-1.5 sm:py-2 bg-slate-800 border-2 border-amber-500 rounded text-white text-xs font-bold">
              <option value="">-- SELEC --</option>
              {professionals.map(p => <option key={p.id} value={p.alias}>{p.alias} - {p.firstName}</option>)}
            </select>
          </div>
          <button onClick={scrollToToday}
            className="bg-amber-500 hover:bg-amber-400 text-black font-black px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition shrink-0">
            HOY
          </button>
        </div>
        <div className="flex gap-2 mt-2 items-center flex-wrap">
          <span className="text-[10px] text-slate-500 font-bold uppercase">Filtrar:</span>
          {uniqueColors.map(c => (
            <div key={c} onClick={() => setFilters(f => f.includes(c) ? f.filter(x => x !== c) : [...f, c])}
              className="w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-125" 
              style={{ background: c, border: filters.includes(c) ? "2px solid white" : "1px solid #555" }} />
          ))}
          {filters.length > 0 && (
            <button onClick={() => setFilters([])} className="text-[10px] text-slate-400 hover:text-white font-bold">✕ Limpiar</button>
          )}
          <div className="hidden sm:flex text-[10px] text-slate-400 items-center gap-3 ml-auto">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/50 border border-red-400 inline-block" /> Aviso</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500/15 border border-purple-400 inline-block" /> Finde</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/20 border border-red-400 inline-block" /> Festivo</span>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto relative" ref={scrollRef}>
        <table className="border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 bg-black border-r-[3px] border-amber-500 px-2 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-xs text-blue-400 font-bold text-left w-[120px] sm:w-[200px] min-w-[120px] sm:min-w-[200px]">SEDES / TAREAS</th>
              {daysArr.map((d, i) => {
                const f = fmt(d);
                const isToday = f === todayStr;
                return (
                  <th key={i} ref={isToday ? todayRef : undefined}
                    className={`${isToday ? "bg-amber-500 !text-black" : "bg-slate-900"} px-0.5 sm:px-1 py-1 sm:py-2 text-[8px] sm:text-[9px] font-bold min-w-[44px] sm:min-w-[60px] text-center border-b-2 border-slate-700`}>
                    {DOW[d.getDay()]}<br />{d.getDate()}/{d.getMonth() + 1}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredSedes.map(sede => (
              <tr key={sede.id}>
                <td className="sticky left-0 z-10 bg-black border-r-[3px] border-amber-500 px-2 sm:px-3 py-1 sm:py-2 border-b-2 border-white/90">
                  <div className="font-bold text-[11px] sm:text-sm" style={{ borderLeft: `6px sm:8px solid ${sede.color}`, paddingLeft: 6 }}>{sede.name}</div>
                  <div className="text-[8px] sm:text-[10px] text-slate-400">{sede.task}</div>
                </td>
                {daysArr.map((d, i) => {
                  const f = fmt(d);
                  const we = isWE(d);
                  const fest = isFestivo(f, sede.province);
                  const planM = getPlan(sede.id, f, "MANANA");
                  const planT = getPlan(sede.id, f, "TARDE");
                  const avisoM = getAviso(sede.id, f, "MANANA");
                  const avisoT = getAviso(sede.id, f, "TARDE");
                  const isToday = f === todayStr;
                  return (
                    <td key={i} className={`border-b-2 border-white/90 h-[44px] sm:h-[60px] min-w-[44px] sm:min-w-[60px] p-0.5 sm:p-1 ${we ? "bg-purple-500/15" : ""} ${fest ? "bg-red-500/20" : ""} ${isToday && !we && !fest ? "ring-1 ring-amber-500/50" : ""}`}>
                      <div className="flex flex-col gap-0.5 items-center justify-center">
                        {sede.morningEnabled && (
                          <div onClick={() => avisoM ? handleAvisoClick(sede.id, f, "MANANA") : handleSlotClick(sede.id, f, "MANANA")}
                            className={`h-5 sm:h-6 w-[85%] rounded flex items-center justify-center text-[7px] sm:text-[9px] font-bold cursor-pointer transition ${
                              avisoM ? "bg-red-500/50 text-red-200 border border-red-400" :
                              planM ? "text-black border border-white" : "text-white/20 border border-white/5"}`}
                            style={{ background: avisoM ? undefined : (planM ? sede.color : "transparent"), borderLeft: (avisoM || planM) ? undefined : "3px solid #3b82f6" }}>
                            {avisoM ? `⚠${avisoM.professional?.alias || "—"}` : (planM?.professionalAlias || "M")}
                          </div>
                        )}
                        {sede.afternoonEnabled && (
                          <div onClick={() => avisoT ? handleAvisoClick(sede.id, f, "TARDE") : handleSlotClick(sede.id, f, "TARDE")}
                            className={`h-5 sm:h-6 w-[85%] rounded flex items-center justify-center text-[7px] sm:text-[9px] font-bold cursor-pointer transition ${
                              avisoT ? "bg-red-500/50 text-red-200 border border-red-400" :
                              planT ? "text-black border border-white" : "text-white/20 border border-white/5"}`}
                            style={{ background: avisoT ? undefined : (planT ? sede.color : "transparent"), borderLeft: (avisoT || planT) ? undefined : "3px solid #f59e0b" }}>
                            {avisoT ? `⚠${avisoT.professional?.alias || "—"}` : (planT?.professionalAlias || "T")}
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
