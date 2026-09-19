"use client";

import { useState, useEffect, useRef } from "react";
import VoiceAvisoButton from "@/components/VoiceAvisoButton";

interface PlanEntry {
  id: string;
  sedeId: string;
  date: string;
  turn: string;
  professionalAlias: string;
  notes?: string;
}

interface AvisoEntry {
  id: string;
  date: string;
  sedeId: string;
  turn: string; // M | T
  professionalId: string | null;
  reason: string;
  note?: string;
  professional?: { alias: string; firstName: string; lastName: string } | null;
  sede?: { name: string } | null;
}

type CardFilter = "todas" | "nota" | "sin";

export default function MensualTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [sedes, setSedes] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [plans, setPlans] = useState<PlanEntry[]>([]);
  const [avisos, setAvisos] = useState<AvisoEntry[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [selectedSedes, setSelectedSedes] = useState<Set<string>>(new Set());
  const [selectedPros, setSelectedPros] = useState<Set<string>>(new Set());
  const [showSedeDD, setShowSedeDD] = useState(false);
  const [showProDD, setShowProDD] = useState(false);
  const [cardFilter, setCardFilter] = useState<CardFilter>("todas");
  const [showVac, setShowVac] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Note editor modal: open when a card is clicked
  const [noteModal, setNoteModal] = useState<{ planId: string; sedeName: string; sedeTask: string; proName: string; date: string; turn: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // Aviso note editor modal (click on an aviso card)
  const [avisoNoteModal, setAvisoNoteModal] = useState<{ avisoId: string; sedeName: string; proName: string; date: string; turn: string; reason: string } | null>(null);

  // ── Month navigation: swipe táctil + flechas ‹ › ──
  const [slideDir, setSlideDir] = useState<"" | "next" | "prev">("");
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const goMonth = (dir: 1 | -1) => {
    setSlideDir(dir === 1 ? "next" : "prev");
    const m = month + dir;
    if (m < 0) { setMonth(11); setYear(y => y - 1); }
    else if (m > 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m);
  };

  const onTouchStartCal = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEndCal = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    // Deslizar a la izquierda → mes siguiente; a la derecha → mes anterior.
    // Solo si el gesto es claramente horizontal (no interfiere con el scroll vertical).
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    goMonth(dx < 0 ? 1 : -1);
  };

  async function load() {
    const [sRes, pRes, plRes, hRes, aRes] = await Promise.all([
      fetch("/api/company/sedes"),
      fetch("/api/company/professionals"),
      fetch(`/api/company/plan?year=${year}&month=${month}`),
      fetch("/api/company/holidays"),
      fetch("/api/company/avisos"),
    ]);
    const s = sRes.ok ? await sRes.json() : [];
    const p = pRes.ok ? await pRes.json() : [];
    setSedes(s);
    setProfessionals(p);
    if (plRes.ok) setPlans(await plRes.json());
    if (hRes.ok) setHolidays(await hRes.json());
    if (aRes.ok) setAvisos(await aRes.json());
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

  // Open the note editor for a specific plan card
  const openNoteEditor = (plan: PlanEntry, sede: any, proName: string) => {
    setNoteModal({
      planId: plan.id,
      sedeName: sede.name,
      sedeTask: sede.task,
      proName,
      date: plan.date,
      turn: plan.turn,
    });
    setNoteText(plan.notes || "");
  };

  const closeNoteEditor = () => {
    setNoteModal(null);
    setNoteText("");
  };

  const saveNote = async () => {
    if (!noteModal) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/company/plan/${noteModal.planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: noteText }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPlans(prev => prev.map(p => p.id === noteModal.planId ? { ...p, notes: updated.notes } : p));
        closeNoteEditor();
      } else {
        alert("No se pudo guardar la nota.");
      }
    } catch (e) {
      alert("Error de red al guardar la nota.");
    } finally {
      setNoteSaving(false);
    }
  };

  // ── Aviso note editor ──
  const openAvisoNoteEditor = (a: AvisoEntry) => {
    const sede = sedes.find(x => x.id === a.sedeId);
    const proName = a.professional
      ? `${a.professional.firstName || ""} ${a.professional.lastName || ""}`.trim() || a.professional.alias
      : "";
    setAvisoNoteModal({
      avisoId: a.id,
      sedeName: sede?.name || "",
      proName,
      date: a.date,
      turn: a.turn,
      reason: (a.reason || "AUSENCIA").toUpperCase(),
    });
    setNoteText(a.note || "");
  };

  const saveAvisoNote = async () => {
    if (!avisoNoteModal) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/company/avisos/${avisoNoteModal.avisoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAvisos(prev => prev.map(a => a.id === avisoNoteModal.avisoId ? { ...a, note: updated.note } : a));
        setAvisoNoteModal(null);
        setNoteText("");
      } else {
        alert("No se pudo guardar la nota del aviso.");
      }
    } catch {
      alert("Error de red al guardar la nota del aviso.");
    } finally {
      setNoteSaving(false);
    }
  };

  // Format date label for the modal
  const formatDateLabel = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const wd = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"][date.getDay()];
    return `${wd} ${d}/${m}/${y}`;
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
      const dayPlans = plans.filter((p: PlanEntry) => p.sedeId === sede.id && p.date === f);
      dayPlans.forEach((p: PlanEntry) => {
        if (!selectedPros.has(p.professionalAlias)) return;
        // Card filter by note presence
        const hasNoteCard = !!(p.notes && p.notes.trim());
        if (cardFilter === "nota" && !hasNoteCard) return;
        if (cardFilter === "sin" && hasNoteCard) return;
        const pro = professionals.find((x: any) => x.alias === p.professionalAlias);
        const nombre = pro ? `${pro.firstName} ${pro.lastName}` : p.professionalAlias;
        const turnLabel = p.turn === "MANANA" ? "M" : "T";
        const hasNote = !!(p.notes && p.notes.trim());
        const notePreview = hasNote ? p.notes!.trim() : "";
        // Truncate tooltip preview
        const tooltipLines = [
          `${sede.name} / ${sede.task} · ${p.turn === "MANANA" ? "Mañana" : "Tarde"} · ${nombre}`,
          hasNote ? `📝 ${notePreview.length > 200 ? notePreview.slice(0, 200) + "…" : notePreview}` : "Click para añadir nota",
        ].join("\n");
        assigns.push(
          <div
            key={p.id}
            onClick={(e) => { e.stopPropagation(); openNoteEditor(p, sede, nombre); }}
            className="text-[9px] px-1 py-0.5 rounded font-bold leading-tight border border-black/10 break-words cursor-pointer hover:ring-2 hover:ring-amber-500 hover:ring-offset-0 transition relative"
            style={{ background: sede.color, color: textColorFor(sede.color) }}
            title={tooltipLines}
          >
            <span className="inline-block font-black px-0.5 mr-0.5 bg-black/80 text-white rounded-[2px]">{turnLabel}</span>
            {sede.name} / {sede.task} - {nombre}
            {hasNote && (
              <span
                className="absolute top-0 right-0 -mt-1 -mr-1 text-[10px] bg-amber-400 text-black rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold border border-black/60 leading-none"
                title="Tiene nota"
              >•</span>
            )}
          </div>
        );
      });
    });

    // ── Vacation / absence cards (avisos) ──
    if (showVac) {
      const dayAvisos = avisos.filter(a => a.date === f && selectedSedes.has(a.sedeId));
      dayAvisos.forEach(a => {
        // Pro filter: sede-level avisos (no professional) always show; pro-level only if selected
        const avisoProAlias = a.professional?.alias;
        if (avisoProAlias && !selectedPros.has(avisoProAlias)) return;
        const sede = sedes.find(x => x.id === a.sedeId);
        const proName = a.professional
          ? `${a.professional.firstName || ""} ${a.professional.lastName || ""}`.trim() || avisoProAlias
          : "";
        const reason = (a.reason || "AUSENCIA").toUpperCase();
        const turnLabel = a.turn === "M" ? "M" : a.turn === "T" ? "T" : "";
        const hasNote = !!(a.note && a.note.trim());
        const notePreview = hasNote ? a.note!.trim() : "";
        assigns.push(
          <div
            key={`av-${a.id}`}
            onClick={(e) => { e.stopPropagation(); openAvisoNoteEditor(a); }}
            className="text-[9px] px-1 py-0.5 rounded font-bold leading-tight border border-red-900/40 break-words cursor-pointer hover:ring-2 hover:ring-red-500 hover:ring-offset-0 transition relative"
            style={{
              background: "repeating-linear-gradient(45deg, #fee2e2, #fee2e2 5px, #fecaca 5px, #fecaca 10px)",
              color: "#7f1d1d",
            }}
            title={[
              `${reason}${proName ? ` · ${proName}` : ""}${sede ? ` · ${sede.name}` : ""}${a.turn ? ` · ${a.turn === "M" ? "Mañana" : "Tarde"}` : ""}`,
              hasNote ? `📝 ${notePreview.length > 200 ? notePreview.slice(0, 200) + "…" : notePreview}` : "Click para añadir nota al aviso",
            ].join("\n")}
          >
            {turnLabel && <span className="inline-block font-black px-0.5 mr-0.5 bg-red-900 text-white rounded-[2px]">{turnLabel}</span>}
            <span className="font-black">🏖 {reason}</span>
            {proName ? ` - ${avisoProAlias || proName}` : ""}
            {sede ? ` (${sede.name})` : ""}
            {hasNote && (
              <span
                className="absolute top-0 right-0 -mt-1 -mr-1 text-[10px] bg-amber-400 text-black rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold border border-black/60 leading-none"
                title="Tiene nota"
              >•</span>
            )}
          </div>
        );
      });
    }

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
        {/* Card type filter: notes */}
        <div>
          <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">TARJETAS</label>
          <select
            value={cardFilter}
            onChange={e => setCardFilter(e.target.value as CardFilter)}
            className="w-40 sm:w-44 px-2 py-1.5 sm:py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs font-bold"
          >
            <option value="todas">Todas</option>
            <option value="nota">📝 Solo con nota</option>
            <option value="sin">Sin nota</option>
          </select>
        </div>
        {/* Vacaciones / ausencias toggle */}
        <div>
          <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">VACACIONES</label>
          <button
            onClick={() => setShowVac(!showVac)}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition ${showVac ? "bg-red-500 text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"}`}
            title="Mostrar u ocultar las tarjetas de vacaciones y ausencias"
          >
            {showVac ? "🏖 Mostrando" : "Ocultas"}
          </button>
        </div>
        <button onClick={() => { setSlideDir(""); setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); }} className="bg-amber-500 hover:bg-amber-400 text-black font-black px-3 py-2 rounded-lg text-xs transition">HOY</button>
        <VoiceAvisoButton
          sedes={sedes}
          professionals={professionals}
          onSaved={load}
          contextYear={year}
          contextMonth={month}
        />
        <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-2 rounded-lg text-xs transition">🖨️ PDF</button>
      </div>

      <div
        className="flex-1 overflow-auto bg-white text-gray-900 rounded-xl p-2 sm:p-5"
        id="print-target"
        onTouchStart={onTouchStartCal}
        onTouchEnd={onTouchEndCal}
      >
        <div className="flex justify-between items-end mb-2 border-b-[3px] border-gray-900 pb-2">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <img src="/mural-logo.png" alt="MURAL" className="h-8 sm:h-10 w-auto shrink-0" />
            <button
              onClick={() => goMonth(-1)}
              className="no-print h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-full bg-gray-100 hover:bg-amber-500 hover:text-black text-gray-700 text-xl font-black flex items-center justify-center transition"
              title="Mes anterior (desliza a la derecha)"
            >‹</button>
            <h1 className="text-base sm:text-xl font-black text-gray-900 whitespace-nowrap">{MESES[month].toUpperCase()} {year}</h1>
            <button
              onClick={() => goMonth(1)}
              className="no-print h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-full bg-gray-100 hover:bg-amber-500 hover:text-black text-gray-700 text-xl font-black flex items-center justify-center transition"
              title="Mes siguiente (desliza a la izquierda)"
            >›</button>
          </div>
          <span className="text-[10px] text-gray-500 font-bold hidden sm:block">Click en una tarjeta para añadir/editar nota</span>
        </div>
        <div className="sm:hidden text-center text-[10px] text-gray-400 font-bold mb-2 no-print">
          Desliza el dedo ‹ › para cambiar de mes
        </div>
        <div key={`${year}-${month}`} className={slideDir === "next" ? "month-anim-next" : slideDir === "prev" ? "month-anim-prev" : ""}>
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

      {/* ═══ Aviso note editor modal ═══ */}
      {avisoNoteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => { setAvisoNoteModal(null); setNoteText(""); }}
        >
          <div
            className="bg-white border-2 border-red-900 rounded-xl p-4 sm:p-6 w-full max-w-md space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="border-b-2 border-red-900 pb-2">
              <h3 className="text-gray-900 font-black text-lg">🏖 Nota del aviso</h3>
              <p className="text-[11px] text-gray-600 font-bold uppercase tracking-wide">
                {formatDateLabel(avisoNoteModal.date)} · {avisoNoteModal.turn === "M" ? "Mañana" : "Tarde"} · {avisoNoteModal.reason}
              </p>
              <p className="text-xs text-gray-800 font-bold mt-0.5">
                {avisoNoteModal.sedeName}{avisoNoteModal.proName ? ` · ${avisoNoteModal.proName}` : ""}
              </p>
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-gray-700 uppercase mb-1.5">NOTA DEL AVISO</label>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder="Escribe aquí la nota del aviso…"
                className="w-full px-3 py-2 bg-gray-50 border-2 border-gray-300 focus:border-amber-500 focus:bg-white rounded-lg text-sm text-gray-900 font-medium resize-none outline-none transition"
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-[10px] text-gray-500 font-bold">{noteText.length}/2000</span>
                {noteText.trim().length > 0 && (
                  <button
                    onClick={() => setNoteText("")}
                    className="text-[10px] text-red-600 hover:text-red-800 font-bold uppercase"
                  >Borrar nota</button>
                )}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setAvisoNoteModal(null); setNoteText(""); }}
                disabled={noteSaving}
                className="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold text-sm transition disabled:opacity-50"
              >Cancelar</button>
              <button
                onClick={saveAvisoNote}
                disabled={noteSaving}
                className="flex-1 py-2 px-4 bg-red-900 hover:bg-red-800 text-white rounded-lg font-bold text-sm transition disabled:opacity-50"
              >{noteSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Note editor modal ═══ */}
      {noteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closeNoteEditor}
        >
          <div
            className="bg-white border-2 border-gray-900 rounded-xl p-4 sm:p-6 w-full max-w-md space-y-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="border-b-2 border-gray-900 pb-2">
              <h3 className="text-gray-900 font-black text-lg">Nota del turno</h3>
              <p className="text-[11px] text-gray-600 font-bold uppercase tracking-wide">
                {formatDateLabel(noteModal.date)} · {noteModal.turn === "MANANA" ? "Mañana" : "Tarde"}
              </p>
              <p className="text-xs text-gray-800 font-bold mt-0.5">
                {noteModal.sedeName}{noteModal.sedeTask ? ` / ${noteModal.sedeTask}` : ""} · {noteModal.proName}
              </p>
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-gray-700 uppercase mb-1.5">NOTA</label>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                autoFocus
                maxLength={2000}
                rows={6}
                placeholder="Escribe aquí la nota (visible en tooltip al pasar el ratón)…"
                className="w-full px-3 py-2 bg-gray-50 border-2 border-gray-300 focus:border-amber-500 focus:bg-white rounded-lg text-sm text-gray-900 font-medium resize-none outline-none transition"
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-[10px] text-gray-500 font-bold">{noteText.length}/2000</span>
                {noteText.trim().length > 0 && (
                  <button
                    onClick={() => setNoteText("")}
                    className="text-[10px] text-red-600 hover:text-red-800 font-bold uppercase"
                  >Borrar nota</button>
                )}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={closeNoteEditor}
                disabled={noteSaving}
                className="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold text-sm transition disabled:opacity-50"
              >Cancelar</button>
              <button
                onClick={saveNote}
                disabled={noteSaving}
                className="flex-1 py-2 px-4 bg-gray-900 hover:bg-black text-white rounded-lg font-bold text-sm transition disabled:opacity-50"
              >{noteSaving ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
