"use client";

import { useState, useEffect } from "react";

export default function MensualTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [sedes, setSedes] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [selectedSedes, setSelectedSedes] = useState<Set<string>>(new Set());
  const [selectedPros, setSelectedPros] = useState<Set<string>>(new Set());
  const [showSedeDD, setShowSedeDD] = useState(false);
  const [showProDD, setShowProDD] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const [sRes, pRes, plRes, hRes] = await Promise.all([
      fetch("/api/company/sedes"),
      fetch("/api/company/professionals"),
      fetch(`/api/company/plan?year=${year}&month=${month}`),
      fetch("/api/company/holidays"),
    ]);
    const s = sRes.ok ? await sRes.json() : [];
    const p = pRes.ok ? await pRes.json() : [];
    setSedes(s);
    setProfessionals(p);
    if (plRes.ok) setPlans(await plRes.json());
    if (hRes.ok) setHolidays(await hRes.json());
    if (!loaded) {
      setSelectedSedes(new Set(s.map((x: any) => x.id)));
      setSelectedPros(new Set(p.map((x: any) => x.alias)));
      setLoaded(true);
    }
  }

  useEffect(() => { load(); }, [year, month]);

  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const DOW_HEADER = ["LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES", "SÁBADO", "DOMINGO"];

  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const isWE = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

  const isFestivo = (date: string) => {
    const provs = new Set<string>();
    selectedSedes.forEach(k => { const s = sedes.find(x => x.id === k); if (s) provs.add(s.province); });
    return holidays.some(h => h.date === date && provs.has(h.province));
  };

  const getFestivoProvinces = (date: string) => {
    const provs = new Set<string>();
    selectedSedes.forEach(k => { const s = sedes.find(x => x.id === k); if (s && holidays.some(h => h.date === date && h.province === s.province)) provs.add(s.province); });
    return [...provs];
  };

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

  const filteredSedes = sedes.filter(s => selectedSedes.has(s.id));

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(<td key={`e${i}`} className="border border-gray-300 bg-gray-100 h-[110px]" />);

  for (let day = 1; day <= totalDays; day++) {
    const dateObj = new Date(year, month, day);
    const f = fmt(dateObj);
    const we = isWE(dateObj);
    const fest = isFestivo(f);
    const festProvs = getFestivoProvinces(f);

    const assigns: React.ReactNode[] = [];
    filteredSedes.forEach(sede => {
      const dayPlans = plans.filter((p: any) => p.sedeId === sede.id && p.date === f);
      dayPlans.forEach((p: any) => {
        if (!selectedPros.has(p.professionalAlias)) return;
        const pro = professionals.find((x: any) => x.alias === p.professionalAlias);
        const nombre = pro ? `${pro.firstName} ${pro.lastName}` : p.professionalAlias;
        const turnLabel = p.turn === "MANANA" ? "M" : "T";
        assigns.push(
          <div key={p.id} className="text-[9px] px-1 py-0.5 rounded font-bold leading-tight border border-black/10 break-words"
            style={{ background: sede.color, color: textColorFor(sede.color) }}
            title={`${sede.name} / ${sede.task} · ${p.turn} · ${nombre}`}>
            <span className="inline-block font-black px-0.5 mr-0.5 bg-black/80 text-white rounded-[2px]">{turnLabel}</span>
            {sede.name} / {sede.task} - {nombre}
          </div>
        );
      });
    });

    const tdClass = fest ? "bg-red-100" : we ? "bg-purple-50" : "bg-gray-50";
    cells.push(
      <td key={day} className={`border border-gray-300 h-[110px] p-1 align-top ${tdClass}`}>
        <div className="font-black text-[13px] text-gray-900 flex justify-between items-center">
          <span>{day}</span>
          {fest && <span className="text-[8px] font-black bg-red-700 text-white px-1 py-0.5 rounded">FESTIVO · {festProvs.join(", ")}</span>}
        </div>
        <div className="flex flex-col gap-0.5 mt-1">{assigns}</div>
      </td>
    );
  }

  while (cells.length % 7 !== 0) cells.push(<td key={`te${cells.length}`} className="border border-gray-300 bg-gray-100" />);

  const rows: React.ReactNode[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(<tr key={i}>{cells.slice(i, i + 7)}</tr>);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-2 sm:p-3 mb-2 sm:mb-3 flex gap-2 sm:gap-3 items-end flex-wrap shrink-0 no-print">
        <div>
          <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">AÑO</label>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-20 sm:w-24 px-2 py-1.5 sm:py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs">
            {Array.from({ length: 15 }, (_, i) => 2026 + i).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">MES</label>
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="w-28 sm:w-32 px-2 py-1.5 sm:py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs">
            {MESES.map((m, i) => <option key={i} value={i}>{m.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="relative">
          <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">SEDES</label>
          <button onClick={() => { setShowSedeDD(!showSedeDD); setShowProDD(false); }}
            className="sm:min-w-[260px] w-full sm:w-auto px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs font-bold flex justify-between items-center">
            <span>{selectedSedes.size === sedes.length ? `Todas (${sedes.length})` : `${selectedSedes.size}/${sedes.length} sedes`}</span>
            <span className="text-amber-500">▼</span>
          </button>
          {showSedeDD && (
            <div className="absolute top-full mt-1 left-0 right-0 sm:min-w-[320px] sm:right-auto max-h-[300px] overflow-y-auto bg-slate-900 border border-amber-500 rounded-lg z-50 shadow-2xl p-2">
              <div className="flex gap-1 pb-2 mb-2 border-b border-slate-700">
                <button onClick={() => setSelectedSedes(new Set(sedes.map(s => s.id)))} className="flex-1 bg-slate-800 hover:bg-amber-500 hover:text-black text-xs px-2 py-1 rounded font-bold">TODAS</button>
                <button onClick={() => setSelectedSedes(new Set())} className="flex-1 bg-slate-800 hover:bg-amber-500 hover:text-black text-xs px-2 py-1 rounded font-bold">NINGUNA</button>
              </div>
              {sedes.map(s => (
                <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-800 rounded">
                  <input type="checkbox" checked={selectedSedes.has(s.id)} onChange={() => {
                    const n = new Set(selectedSedes); n.has(s.id) ? n.delete(s.id) : n.add(s.id); setSelectedSedes(n);
                  }} className="accent-amber-500 w-3.5 h-3.5" />
                  <div className="w-3.5 h-3.5 rounded-sm" style={{ background: s.color }} />
                  <span className="text-xs font-bold">{s.name}</span>
                  <span className="text-[10px] text-slate-400">{s.task ? `/ ${s.task}` : ""}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">PROFESIONALES</label>
          <button onClick={() => { setShowProDD(!showProDD); setShowSedeDD(false); }}
            className="sm:min-w-[240px] w-full sm:w-auto px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs font-bold flex justify-between items-center">
            <span>{selectedPros.size === professionals.length ? `Todos (${professionals.length})` : `${selectedPros.size}/${professionals.length}`}</span>
            <span className="text-amber-500">▼</span>
          </button>
          {showProDD && (
            <div className="absolute top-full mt-1 left-0 right-0 sm:min-w-[280px] sm:right-auto max-h-[300px] overflow-y-auto bg-slate-900 border border-amber-500 rounded-lg z-50 shadow-2xl p-2">
              <div className="flex gap-1 pb-2 mb-2 border-b border-slate-700">
                <button onClick={() => setSelectedPros(new Set(professionals.map(p => p.alias)))} className="flex-1 bg-slate-800 hover:bg-amber-500 hover:text-black text-xs px-2 py-1 rounded font-bold">TODOS</button>
                <button onClick={() => setSelectedPros(new Set())} className="flex-1 bg-slate-800 hover:bg-amber-500 hover:text-black text-xs px-2 py-1 rounded font-bold">NINGUNO</button>
              </div>
              {professionals.map(p => (
                <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-slate-800 rounded">
                  <input type="checkbox" checked={selectedPros.has(p.alias)} onChange={() => {
                    const n = new Set(selectedPros); n.has(p.alias) ? n.delete(p.alias) : n.add(p.alias); setSelectedPros(n);
                  }} className="accent-amber-500 w-3.5 h-3.5" />
                  <span className="text-xs font-bold">{p.alias}</span>
                  <span className="text-[10px] text-slate-400">{p.firstName} {p.lastName}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); }} className="bg-amber-500 hover:bg-amber-400 text-black font-black px-3 py-2 rounded-lg text-xs transition">HOY</button>
        <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-2 rounded-lg text-xs transition hidden sm:block">🖨️ PDF</button>
      </div>

      <div className="flex-1 overflow-auto bg-white text-gray-900 rounded-xl p-5" id="print-target">
        <div className="flex justify-between items-end mb-3 border-b-[3px] border-gray-900 pb-2">
          <h1 className="text-xl font-black text-gray-900">{MESES[month].toUpperCase()} {year}</h1>
          <div className="text-xs text-gray-500 text-right">MURAL PLASTIC SURGERY</div>
        </div>
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr>
              {DOW_HEADER.map((d, i) => (
                <th key={i} className={`py-2 text-[11px] font-bold text-center border border-gray-900 ${i >= 5 ? "bg-purple-900" : "bg-gray-900"}`} style={{ color: "#fff" }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </div>
  );
}
