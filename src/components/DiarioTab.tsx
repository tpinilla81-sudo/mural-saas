"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const AVISO_REASONS = ["BAJA", "FORMACION", "PERMISO", "VACACIONES"] as const;
type AvisoReason = (typeof AVISO_REASONS)[number];

interface Sede {
  id: string;
  name: string;
  city: string;
  province: string;
  task: string;
  color: string;
  morningEnabled: boolean;
  afternoonEnabled: boolean;
  order: number;
  email: string;
  phone: string;
}

interface Professional {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
  type: string;
  category: string;
  permissions: string;
  assignedSedes: string;
}

interface PlanEntry {
  id: string;
  sedeId: string;
  date: string;
  turn: string;
  professionalAlias: string;
}

interface AvisoEntry {
  id: string;
  date: string;
  professionalId: string | null; // nullable: sede-level absences don't have a professional
  sedeId: string;
  turn: string;
  reason: string;
  professional?: Professional | null;
}

interface Holiday {
  id: string;
  province: string;
  date: string;
}

export default function DiarioTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [plans, setPlans] = useState<PlanEntry[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [avisos, setAvisos] = useState<AvisoEntry[]>([]);

  // Selected professional for assignment
  const [selectedPro, setSelectedPro] = useState("");

  // Filters
  const [filterColors, setFilterColors] = useState<string[]>([]);
  const [filterPro, setFilterPro] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterProvince, setFilterProvince] = useState("");
  const [filterAvisoReason, setFilterAvisoReason] = useState("");

  // Aviso creation modal
  const [avisoModal, setAvisoModal] = useState<{ sedeId: string; date: string; turn: string } | null>(null);
  const [avisoReason, setAvisoReason] = useState<AvisoReason>("VACACIONES");

  // View mode
  const [viewMode, setViewMode] = useState<"full" | "compact">("full");
  const [showFilters, setShowFilters] = useState(false);

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
  const getPlan = useCallback((sedeId: string, date: string, turn: string) =>
    plans.find(p => p.sedeId === sedeId && p.date === date && p.turn === turn), [plans]);
  const getAviso = useCallback((sedeId: string, date: string, turn: string) => {
    const t = turn === "MANANA" ? "M" : "T";
    return avisos.find(a => a.sedeId === sedeId && a.date === date && a.turn === t);
  }, [avisos]);

  // Compute unique filter values
  const uniqueColors = [...new Set(sedes.map(s => s.color))];
  const uniqueCities = [...new Set(sedes.map(s => s.city).filter(Boolean))].sort();
  const uniqueProvinces = [...new Set(sedes.map(s => s.province).filter(Boolean))].sort();

  // Apply all filters to sedes
  const filteredSedes = sedes.filter(s => {
    if (filterColors.length > 0 && !filterColors.includes(s.color)) return false;
    if (filterCity && s.city !== filterCity) return false;
    if (filterProvince && s.province !== filterProvince) return false;
    // If filtering by professional, show only sedes where that professional is assigned today or has plans
    if (filterPro) {
      const pro = professionals.find(p => p.alias === filterPro);
      if (pro) {
        const proSedes = pro.assignedSedes.split(",").map(s => s.trim().toUpperCase());
        if (!proSedes.includes(s.name.toUpperCase())) return false;
      }
    }
    return true;
  }).sort((a, b) => a.order - b.order);

  // Check if any aviso in visible data matches the reason filter
  const hasAvisoReasonMatch = useCallback((sedeId: string, date: string) => {
    if (!filterAvisoReason) return true;
    const avisoM = getAviso(sedeId, date, "MANANA");
    const avisoT = getAviso(sedeId, date, "TARDE");
    if (avisoM && avisoM.reason === filterAvisoReason) return true;
    if (avisoT && avisoT.reason === filterAvisoReason) return true;
    return false;
  }, [filterAvisoReason, getAviso]);

  // Check if professional filter matches any cell in this row
  const hasProInRow = useCallback((sedeId: string) => {
    if (!filterPro) return true;
    // Show the row if the selected pro has any plan in this sede
    return plans.some(p => p.sedeId === sedeId && p.professionalAlias === filterPro);
  }, [filterPro, plans]);

  const scrollToToday = () => {
    const now = new Date();
    if (year !== now.getFullYear()) {
      setYear(now.getFullYear());
      // scroll will happen via useEffect after data loads for the new year
      return;
    }
    if (todayRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const cell = todayRef.current;
      const left = cell.offsetLeft - container.clientWidth / 3;
      container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }
  };

  // Click on a plan slot (assign professional)
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
    if (isWE(new Date(date)) || (sede && isFestivo(date, sede.province))) {
      if (!confirm("Es festivo/fin de semana. ¿Continuar?")) return;
    }
    await fetch("/api/company/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sedeId, date, turn, professionalAlias: selectedPro }),
    });
    load();
  };

  // Open aviso modal
  const openAvisoModal = (sedeId: string, date: string, turn: string) => {
    const existing = getAviso(sedeId, date, turn);
    if (existing) {
      if (confirm(`¿Eliminar aviso${existing.reason ? ` (${existing.reason})` : ""}?`)) {
        fetch(`/api/company/avisos/${existing.id}`, { method: "DELETE" }).then(load);
      }
      return;
    }
    setAvisoModal({ sedeId, date, turn });
    setAvisoReason("VACACIONES");
  };

  // Confirm aviso creation
  const confirmAviso = async () => {
    if (!avisoModal) return;
    const t = avisoModal.turn === "MANANA" ? "M" : "T";
    const pro = selectedPro ? professionals.find(p => p.alias === selectedPro) : null;
    await fetch("/api/company/avisos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: avisoModal.date,
        professionalId: pro?.id || null,
        sedeId: avisoModal.sedeId,
        turn: t,
        reason: avisoReason,
      }),
    });
    setAvisoModal(null);
    load();
  };

  // Get aviso reason color
  const getAvisoColor = (reason: string) => {
    switch (reason) {
      case "BAJA": return "bg-red-600/70 text-red-100 border-red-400";
      case "FORMACION": return "bg-blue-600/70 text-blue-100 border-blue-400";
      case "PERMISO": return "bg-yellow-600/70 text-yellow-100 border-yellow-400";
      case "VACACIONES": return "bg-orange-600/70 text-orange-100 border-orange-400";
      default: return "bg-red-500/50 text-red-200 border-red-400";
    }
  };

  // Get aviso reason short label
  const getAvisoLabel = (reason: string) => {
    switch (reason) {
      case "BAJA": return "BAJ";
      case "FORMACION": return "FOR";
      case "PERMISO": return "PER";
      case "VACACIONES": return "VAC";
      default: return reason.substring(0, 3).toUpperCase();
    }
  };

  // Count assignments per professional for current view
  const proCounts: Record<string, { morning: number; afternoon: number; avisos: number }> = {};
  professionals.forEach(p => { proCounts[p.alias] = { morning: 0, afternoon: 0, avisos: 0 }; });
  filteredSedes.forEach(sede => {
    daysArr.forEach(d => {
      const f = fmt(d);
      const planM = getPlan(sede.id, f, "MANANA");
      const planT = getPlan(sede.id, f, "TARDE");
      if (planM && proCounts[planM.professionalAlias]) proCounts[planM.professionalAlias].morning++;
      if (planT && proCounts[planT.professionalAlias]) proCounts[planT.professionalAlias].afternoon++;
      const avisoM = getAviso(sede.id, f, "MANANA");
      const avisoT = getAviso(sede.id, f, "TARDE");
      if (avisoM) {
        const pro = professionals.find(p => p.id === avisoM.professionalId);
        if (pro && proCounts[pro.alias]) proCounts[pro.alias].avisos++;
      }
      if (avisoT) {
        const pro = professionals.find(p => p.id === avisoT.professionalId);
        if (pro && proCounts[pro.alias]) proCounts[pro.alias].avisos++;
      }
    });
  });

  const clearAllFilters = () => {
    setFilterColors([]);
    setFilterPro("");
    setFilterCity("");
    setFilterProvince("");
    setFilterAvisoReason("");
  };

  const hasAnyFilter = filterColors.length > 0 || filterPro || filterCity || filterProvince || filterAvisoReason;

  const cellW = viewMode === "compact" ? "min-w-[28px] sm:min-w-[44px]" : "min-w-[36px] sm:min-w-[60px]";
  const cellH = viewMode === "compact" ? "h-[32px] sm:h-[44px]" : "h-[44px] sm:h-[60px]";
  const textSize = viewMode === "compact" ? "text-[6px] sm:text-[8px]" : "text-[7px] sm:text-[9px]";

  return (
    <div className="flex flex-col h-full overflow-hidden border border-slate-700 rounded-xl bg-slate-800/50">
      {/* ═══ Toolbar ═══ */}
      <div className="bg-slate-900 p-2 sm:p-3 border-b border-slate-700 shrink-0">
        <div className="flex gap-2 sm:gap-3 items-end flex-wrap">
          {/* Year */}
          <div>
            <label className="block text-[10px] sm:text-xs font-extrabold text-blue-400 uppercase mb-1">AÑO</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-16 sm:w-20 px-1.5 sm:px-2 py-1.5 sm:py-2 bg-slate-800 border border-slate-600 rounded text-white text-xs">
              {Array.from({ length: 15 }, (_, i) => 2026 + i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Professional selector */}
          <div className="flex-1 min-w-[120px] sm:min-w-0 sm:flex-none">
            <label className="block text-[10px] sm:text-xs font-extrabold text-blue-400 uppercase mb-1">PROFESIONAL</label>
            <select value={selectedPro} onChange={e => setSelectedPro(e.target.value)} className="w-full sm:w-52 px-1.5 sm:px-2 py-1.5 sm:py-2 bg-slate-800 border-2 border-amber-500 rounded text-white text-xs font-bold">
              <option value="">-- SELEC --</option>
              {professionals.sort((a, b) => a.alias.localeCompare(b.alias)).map(p => (
                <option key={p.id} value={p.alias}>{p.alias} - {p.firstName}</option>
              ))}
            </select>
          </div>

          {/* Today button */}
          <button onClick={scrollToToday}
            className="bg-amber-500 hover:bg-amber-400 text-black font-black px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition shrink-0">
            HOY
          </button>

          {/* View mode toggle */}
          <button onClick={() => setViewMode(v => v === "full" ? "compact" : "full")}
            className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs transition shrink-0">
            {viewMode === "full" ? "▦" : "▤"} <span className="hidden sm:inline">{viewMode === "full" ? "Compacto" : "Normal"}</span>
          </button>

          {/* Filters toggle */}
          <button onClick={() => setShowFilters(f => !f)}
            className={`font-bold px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs transition shrink-0 ${showFilters ? "bg-blue-600 text-white" : "bg-slate-700 hover:bg-slate-600 text-white"}`}>
            🔍 <span className="hidden sm:inline">Filtros</span> {hasAnyFilter ? "●" : ""}
          </button>
        </div>

        {/* ═══ Filter Bar ═══ */}
        {showFilters && (
          <div className="mt-2 p-2 bg-slate-800/80 rounded-lg border border-slate-600 space-y-2">
            {/* Color filter (sede groups) */}
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-[10px] text-slate-500 font-bold uppercase w-14 shrink-0">Sede:</span>
              {uniqueColors.map(c => (
                <div key={c} onClick={() => setFilterColors(f => f.includes(c) ? f.filter(x => x !== c) : [...f, c])}
                  className="w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-125"
                  style={{ background: c, border: filterColors.includes(c) ? "2px solid white" : "1px solid #555" }} />
              ))}
            </div>

            {/* Professional filter */}
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-[10px] text-slate-500 font-bold uppercase w-14 shrink-0">Pro:</span>
              <select value={filterPro} onChange={e => setFilterPro(e.target.value)}
                className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-[10px] sm:text-xs flex-1 sm:flex-none sm:w-40">
                <option value="">Todos</option>
                {professionals.sort((a, b) => a.alias.localeCompare(b.alias)).map(p => (
                  <option key={p.id} value={p.alias}>{p.alias} - {p.firstName}</option>
                ))}
              </select>
            </div>

            {/* City filter */}
            {uniqueCities.length > 0 && (
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-[10px] text-slate-500 font-bold uppercase w-14 shrink-0">Ciudad:</span>
                <select value={filterCity} onChange={e => setFilterCity(e.target.value)}
                  className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-[10px] sm:text-xs flex-1 sm:flex-none sm:w-40">
                  <option value="">Todas</option>
                  {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {/* Province filter */}
            {uniqueProvinces.length > 0 && (
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-[10px] text-slate-500 font-bold uppercase w-14 shrink-0">Prov.:</span>
                <select value={filterProvince} onChange={e => setFilterProvince(e.target.value)}
                  className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-[10px] sm:text-xs flex-1 sm:flex-none sm:w-40">
                  <option value="">Todas</option>
                  {uniqueProvinces.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            )}

            {/* Aviso reason filter */}
            <div className="flex gap-2 items-center flex-wrap">
              <span className="text-[10px] text-slate-500 font-bold uppercase w-14 shrink-0">Aviso:</span>
              <select value={filterAvisoReason} onChange={e => setFilterAvisoReason(e.target.value)}
                className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-[10px] sm:text-xs flex-1 sm:flex-none sm:w-40">
                <option value="">Todos</option>
                {AVISO_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Clear filters */}
            {hasAnyFilter && (
              <button onClick={clearAllFilters} className="text-[10px] text-red-400 hover:text-red-300 font-bold">
                ✕ Limpiar todos los filtros
              </button>
            )}
          </div>
        )}

        {/* Color filter quick access (always visible) + Legend */}
        <div className="flex gap-2 mt-2 items-center flex-wrap">
          <span className="text-[10px] text-slate-500 font-bold uppercase">Filtrar:</span>
          {uniqueColors.map(c => {
            const sedeNames = sedes.filter(s => s.color === c).map(s => s.name);
            return (
              <div key={c} onClick={() => setFilterColors(f => f.includes(c) ? f.filter(x => x !== c) : [...f, c])}
                className="w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-125"
                title={sedeNames.join(", ")}
                style={{ background: c, border: filterColors.includes(c) ? "2px solid white" : "1px solid #555" }} />
            );
          })}
          {filterColors.length > 0 && (
            <button onClick={() => setFilterColors([])} className="text-[10px] text-slate-400 hover:text-white font-bold">✕ Limpiar</button>
          )}

          {/* Legend */}
          <div className="hidden sm:flex text-[10px] text-slate-400 items-center gap-3 ml-auto">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-600/70 border border-red-400 inline-block" /> Baja</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600/70 border border-blue-400 inline-block" /> Formación</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-600/70 border border-yellow-400 inline-block" /> Permiso</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-600/70 border border-orange-400 inline-block" /> Vacaciones</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-500/15 border border-purple-400 inline-block" /> Finde</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/20 border border-red-400 inline-block" /> Festivo</span>
          </div>
        </div>

        {/* Mobile legend (compact) */}
        <div className="sm:hidden flex gap-2 mt-1 overflow-x-auto text-[8px] text-slate-400 pb-1">
          <span className="flex items-center gap-0.5 shrink-0"><span className="w-2 h-2 rounded bg-red-600/70 inline-block" />B</span>
          <span className="flex items-center gap-0.5 shrink-0"><span className="w-2 h-2 rounded bg-blue-600/70 inline-block" />F</span>
          <span className="flex items-center gap-0.5 shrink-0"><span className="w-2 h-2 rounded bg-yellow-600/70 inline-block" />P</span>
          <span className="flex items-center gap-0.5 shrink-0"><span className="w-2 h-2 rounded bg-orange-600/70 inline-block" />V</span>
          <span className="flex items-center gap-0.5 shrink-0"><span className="w-2 h-2 rounded bg-purple-500/15 inline-block" />WE</span>
          <span className="flex items-center gap-0.5 shrink-0"><span className="w-2 h-2 rounded bg-red-500/20 inline-block" />Fest</span>
        </div>
      </div>

      {/* ═══ Professional Summary Bar ═══ */}
      {selectedPro && proCounts[selectedPro] && (
        <div className="bg-slate-800 border-b border-slate-700 px-3 py-1.5 flex gap-4 items-center text-xs shrink-0 overflow-x-auto">
          <span className="font-bold text-amber-400">{selectedPro}</span>
          <span className="text-green-400">M: {proCounts[selectedPro].morning}</span>
          <span className="text-amber-300">T: {proCounts[selectedPro].afternoon}</span>
          <span className="text-red-400">Avisos: {proCounts[selectedPro].avisos}</span>
          <span className="text-slate-400">Total: {proCounts[selectedPro].morning + proCounts[selectedPro].afternoon}</span>
        </div>
      )}

      {/* ═══ Calendar grid ═══ */}
      <div className="flex-1 overflow-auto relative" ref={scrollRef}>
        <table className="border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              {/* Sede label column - compact on mobile */}
              <th className="sticky left-0 z-20 bg-black border-r-[3px] border-amber-500 px-0.5 sm:px-3 py-1 sm:py-2 text-[9px] sm:text-xs text-blue-400 font-bold text-left w-[50px] sm:w-[200px] min-w-[50px] sm:min-w-[200px]">
                SEDES
              </th>
              {daysArr.map((d, i) => {
                const f = fmt(d);
                const isToday = f === todayStr;
                return (
                  <th key={i} ref={isToday ? todayRef : undefined}
                    className={`${isToday ? "bg-amber-500 !text-black" : "bg-slate-900"} ${cellW} px-0 py-1 sm:py-2 ${viewMode === "compact" ? "text-[6px] sm:text-[8px]" : "text-[7px] sm:text-[9px]"} font-bold text-center border-b-2 border-slate-700`}>
                    {DOW[d.getDay()]}<br />{d.getDate()}/{d.getMonth() + 1}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredSedes.map(sede => {
              // If filtering by professional, only show rows where that pro has assignments
              if (filterPro && !hasProInRow(sede.id)) return null;
              // If filtering by aviso reason, check if any cell matches
              // (we still show the row but highlight matching cells)

              return (
                <tr key={sede.id}>
                  {/* Sede label - very compact on mobile */}
                  <td className="sticky left-0 z-10 bg-black border-r-[3px] border-amber-500 px-0.5 sm:px-3 py-0.5 sm:py-2 border-b-2 border-white/90">
                    {/* Mobile: ultra-compact view */}
                    <div className="sm:hidden">
                      <div className="font-bold text-[8px] leading-tight truncate max-w-[42px]" style={{ borderLeft: `3px solid ${sede.color}`, paddingLeft: 3 }}>
                        {sede.name}
                      </div>
                    </div>
                    {/* Desktop: full view */}
                    <div className="hidden sm:block">
                      <div className="font-bold text-sm" style={{ borderLeft: `8px solid ${sede.color}`, paddingLeft: 8 }}>{sede.name}</div>
                      <div className="text-[10px] text-slate-400">{sede.task}</div>
                    </div>
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

                    // If filtering by professional, dim cells that don't match
                    const proMatchM = !filterPro || (planM && planM.professionalAlias === filterPro) || (avisoM && avisoM.professionalId && professionals.find(p => p.id === avisoM.professionalId)?.alias === filterPro);
                    const proMatchT = !filterPro || (planT && planT.professionalAlias === filterPro) || (avisoT && avisoT.professionalId && professionals.find(p => p.id === avisoT.professionalId)?.alias === filterPro);

                    // If filtering by aviso reason, dim cells that don't match
                    const reasonMatch = !filterAvisoReason || hasAvisoReasonMatch(sede.id, f);

                    const dimCell = filterPro && !proMatchM && !proMatchT;
                    const dimReason = filterAvisoReason && !reasonMatch;

                    return (
                      <td key={i} className={`border-b-2 border-white/90 ${cellH} ${cellW} p-0.5 sm:p-1 ${we ? "bg-purple-500/15" : ""} ${fest ? "bg-red-500/20" : ""} ${isToday && !we && !fest ? "ring-1 ring-amber-500/50" : ""} ${(dimCell || dimReason) ? "opacity-20" : ""}`}>
                        <div className="flex flex-col gap-0.5 items-center justify-center">
                          {sede.morningEnabled && (
                            <div
                              onClick={() => avisoM ? openAvisoModal(sede.id, f, "MANANA") : handleSlotClick(sede.id, f, "MANANA")}
                              className={`${viewMode === "compact" ? "h-4 sm:h-5" : "h-5 sm:h-6"} w-[85%] rounded flex items-center justify-center ${textSize} font-bold cursor-pointer transition ${
                                avisoM ? getAvisoColor(avisoM.reason) :
                                planM ? "text-black border border-white" : "text-white/20 border border-white/5"
                              } ${!proMatchM && filterPro ? "opacity-30" : ""}`}
                              style={{
                                background: avisoM ? undefined : (planM ? sede.color : "transparent"),
                                borderLeft: (avisoM || planM) ? undefined : "2px solid #3b82f6"
                              }}
                              title={avisoM ? `${avisoM.reason || "Aviso"}${avisoM.professionalId ? " - " + (professionals.find(p => p.id === avisoM.professionalId)?.alias || "") : " (sede)"}` : planM ? planM.professionalAlias : "Mañana"}
                            >
                              {avisoM ? getAvisoLabel(avisoM.reason) : (planM?.professionalAlias || "M")}
                            </div>
                          )}
                          {sede.afternoonEnabled && (
                            <div
                              onClick={() => avisoT ? openAvisoModal(sede.id, f, "TARDE") : handleSlotClick(sede.id, f, "TARDE")}
                              className={`${viewMode === "compact" ? "h-4 sm:h-5" : "h-5 sm:h-6"} w-[85%] rounded flex items-center justify-center ${textSize} font-bold cursor-pointer transition ${
                                avisoT ? getAvisoColor(avisoT.reason) :
                                planT ? "text-black border border-white" : "text-white/20 border border-white/5"
                              } ${!proMatchT && filterPro ? "opacity-30" : ""}`}
                              style={{
                                background: avisoT ? undefined : (planT ? sede.color : "transparent"),
                                borderLeft: (avisoT || planT) ? undefined : "2px solid #f59e0b"
                              }}
                              title={avisoT ? `${avisoT.reason || "Aviso"}${avisoT.professionalId ? " - " + (professionals.find(p => p.id === avisoT.professionalId)?.alias || "") : " (sede)"}` : planT ? planT.professionalAlias : "Tarde"}
                            >
                              {avisoT ? getAvisoLabel(avisoT.reason) : (planT?.professionalAlias || "T")}
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ═══ Aviso Modal ═══ */}
      {avisoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setAvisoModal(null)}>
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-4 sm:p-6 w-[90vw] max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-white font-bold text-lg">Crear Aviso</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1">PROFESIONAL</label>
                <div className="text-white font-bold">{selectedPro || <span className="text-slate-400 italic">Sin profesional (cierre de sede)</span>}</div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1">FECHA</label>
                <div className="text-white font-bold">{avisoModal.date}</div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1">TURNO</label>
                <div className="text-white font-bold">{avisoModal.turn === "MANANA" ? "Mañana" : "Tarde"}</div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-bold mb-1">MOTIVO</label>
                <div className="grid grid-cols-2 gap-2">
                  {AVISO_REASONS.map(r => (
                    <button
                      key={r}
                      onClick={() => setAvisoReason(r)}
                      className={`py-2 px-3 rounded-lg font-bold text-xs transition border ${
                        avisoReason === r ? getAvisoColor(r) + " scale-105" : "bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setAvisoModal(null)} className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-sm transition">
                Cancelar
              </button>
              <button onClick={confirmAviso} className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-sm transition">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
