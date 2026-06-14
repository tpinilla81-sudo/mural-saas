"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function UserView() {
  const { data: session } = useSession();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [plans, setPlans] = useState<any[]>([]);
  const [sedes, setSedes] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);

  async function load() {
    const [plRes, sRes, hRes] = await Promise.all([
      fetch(`/api/company/plan?year=${year}&month=${month}`),
      fetch("/api/company/sedes"),
      fetch("/api/company/holidays"),
    ]);
    if (plRes.ok) setPlans(await plRes.json());
    if (sRes.ok) setSedes(await sRes.json());
    if (hRes.ok) setHolidays(await hRes.json());
  }

  useEffect(() => { load(); }, [year, month]);

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

    const dayPlans = plans.filter((p: any) => p.date === f);
    const assigns = dayPlans.map((p: any) => {
      const sede = sedes.find(s => s.id === p.sedeId);
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

  return (
    <div className="flex flex-col h-full p-5 overflow-hidden">
      <div className="flex gap-4 items-end mb-4 shrink-0">
        <div>
          <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">AÑO</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-24 px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs">
            {Array.from({ length: 15 }, (_, i) => 2026 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">MES</label>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="w-32 px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs">
            {MESES.map((m, i) => <option key={i} value={i}>{m.toUpperCase()}</option>)}
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-white text-gray-900 rounded-xl p-5">
        <h1 className="text-xl font-black mb-3 border-b-[3px] border-gray-900 pb-2">{MESES[month].toUpperCase()} {year}</h1>
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr>{DOW_HEADER.map((d, i) => <th key={i} className={`py-2 text-[11px] font-bold text-center border border-gray-900 ${i >= 5 ? "bg-purple-900" : "bg-gray-900"}`} style={{ color: "#fff" }}>{d}</th>)}</tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
}
