"use client";

import { useState, useEffect } from "react";

export default function CalendariosTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [province, setProvince] = useState("");
  const [holidays, setHolidays] = useState<any[]>([]);
  const [sedes, setSedes] = useState<any[]>([]);

  async function load() {
    const [hRes, sRes] = await Promise.all([
      fetch(`/api/company/holidays${province ? `?province=${province}` : ""}`),
      fetch("/api/company/sedes"),
    ]);
    if (hRes.ok) setHolidays(await hRes.json());
    if (sRes.ok) setSedes(await sRes.json());
  }

  useEffect(() => { load(); }, [province, year]);

  const provinces = [...new Set(sedes.map(s => s.province).filter(Boolean))].sort();
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const DOW = ["L", "M", "X", "J", "V", "S", "D"];

  const toggleHoliday = async (date: string) => {
    if (!province) { alert("Selecciona una provincia primero"); return; }
    const existing = holidays.find(h => h.date === date && h.province === province);
    if (existing) {
      await fetch(`/api/company/holidays/${existing.id}`, { method: "DELETE" });
    } else {
      await fetch("/api/company/holidays", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ province, date }) });
    }
    load();
  };

  const isHoliday = (date: string) => holidays.some(h => h.date === date && h.province === province);

  const renderMonth = (month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    let startWeekday = firstDay.getDay();
    startWeekday = startWeekday === 0 ? 6 : startWeekday - 1;
    const totalDays = lastDay.getDate();

    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(<div key={`e${i}`} />);
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const fest = isHoliday(dateStr);
      cells.push(
        <div key={d} onClick={() => toggleHoliday(dateStr)} className={`py-1.5 rounded text-xs cursor-pointer transition ${fest ? "bg-red-500 text-white font-bold" : "bg-slate-900 hover:bg-slate-700"}`}>
          {d}
        </div>
      );
    }

    return (
      <div key={month} className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
        <div className="text-amber-500 font-bold text-xs text-center mb-2 uppercase border-b border-slate-700 pb-1">{MESES[month]}</div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {DOW.map(d => <div key={d} className="text-[9px] text-slate-500 font-bold">{d}</div>)}
          {cells}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 flex gap-4 items-end flex-wrap">
        <div>
          <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">AÑO</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm">
            {Array.from({ length: 15 }, (_, i) => 2026 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">PROVINCIA</label>
          <select value={province} onChange={e => setProvince(e.target.value)} className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm min-w-[180px]">
            <option value="">-- SELEC --</option>
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-y-auto max-h-[calc(100vh-280px)] p-1">
        {Array.from({ length: 12 }, (_, i) => renderMonth(i))}
      </div>
    </div>
  );
}
