"use client";

import { useState, useEffect, useRef } from "react";
import AvisoPicker, {
  AVISO_TOKEN_RE,
  buildAvisoNote,
  clampAvisoDays,
  parseAvisoToken,
  stripAvisoToken,
  useAppUsers,
  usersFromNames,
} from "@/components/AvisoPicker";

interface PlanEntry {
  id: string;
  sedeId: string;
  date: string;
  turn: string;
  professionalAlias: string;
  notes?: string;
  order?: number; // orden manual dentro del día; -1/undefined = auto (M→T→ambas)
}

interface AvisoEntry {
  id: string;
  date: string;
  sedeId: string;
  turn: string; // M | T | "" (ambas)
  professionalId: string | null;
  reason: string;
  note?: string;
  order?: number;
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
  const [filtersOpen, setFiltersOpen] = useState(false); // móvil: menú desplegable
  const [loaded, setLoaded] = useState(false);

  // Note editor modal: open when a card is clicked
  const [noteModal, setNoteModal] = useState<{ planId: string; sedeName: string; sedeTask: string; proName: string; date: string; turn: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  // Aviso note editor modal (click on an aviso card)
  const [avisoNoteModal, setAvisoNoteModal] = useState<{ avisoId: string; sedeName: string; proName: string; date: string; turn: string; reason: string } | null>(null);
  // Fecha destino para MOVER tarjetas a otro día
  const [planMoveDate, setPlanMoveDate] = useState("");
  const [avisoMoveDate, setAvisoMoveDate] = useState("");

  // ── Añadir en Mensual: programar turno (el aviso/ausencia se retiró) ──
  const [addModal, setAddModal] = useState<{ date: string } | null>(null);
  const [addSede, setAddSede] = useState("");
  const [addTurn, setAddTurn] = useState<"MANANA" | "TARDE">("MANANA");
  const [addPro, setAddPro] = useState("");            // alias
  const [addSaving, setAddSaving] = useState(false);

  // ── 🔔 Aviso (notificación) al generar/editar entrada: ¿sí? ¿a quién? ¿días? ──
  // Compartido por los 3 diálogos (alta, nota de turno, nota de aviso).
  const appUsers = useAppUsers();
  const [avisoOn, setAvisoOn] = useState(false);
  const [avisoDays, setAvisoDays] = useState(7);
  const [avisoAll, setAvisoAll] = useState(true);
  const [avisoSel, setAvisoSel] = useState<Set<string>>(new Set());
  const [avisoRawNames, setAvisoRawNames] = useState<string[]>([]);
  const avisoRawTokenRef = useRef(""); // token exacto que venía guardado en la nota

  // ── Compacto por JS (max-width 959px, NO por breakpoint sm:): así, al girar
  // el móvil a horizontal, los filtros NO se despliegan solos ──
  const [isCompact, setIsCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 959px)");
    const apply = () => setIsCompact(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // ── Deep-link desde NOTIFICACIÓN: /?fecha=…&card=…&t=plan|aviso ──
  // Al tocar una push, la app abre MENSUAL en la fecha del aviso y despliega
  // su tarjeta (nota). Cuando se abre, se limpia la URL (no reaparece).
  const deepRef = useRef<{ card: string; t: string; fecha: string | null } | null>(null);
  const loadedMonthRef = useRef<{ y: number; m: number } | null>(null);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const f = sp.get("fecha");
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) {
      setYear(parseInt(f.slice(0, 4), 10));
      setMonth(parseInt(f.slice(5, 7), 10) - 1);
    }
    const card = sp.get("card");
    if (card) deepRef.current = { card, t: sp.get("t") || "plan", fecha: f };
  }, []);
  useEffect(() => {
    const d = deepRef.current;
    if (!loaded || !d) return;
    const target = d.fecha && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha)
      ? { y: parseInt(d.fecha.slice(0, 4), 10), m: parseInt(d.fecha.slice(5, 7), 10) - 1 }
      : null;
    // Solo intenta cuando los datos cargados son los del MES del enlace
    if (target && (loadedMonthRef.current?.y !== target.y || loadedMonthRef.current?.m !== target.m)) return;
    const tryOpen = (): boolean => {
      if (d.t === "aviso") {
        const a = avisos.find(x => x.id === d.card);
        if (a) { openAvisoNoteEditor(a); return true; }
      } else {
        const p = plans.find(x => x.id === d.card);
        if (p) {
          const sede = sedes.find(x => x.id === p.sedeId);
          if (sede) {
            const pro = professionals.find((x: any) => x.alias === p.professionalAlias);
            openNoteEditor(p, sede, pro ? `${pro.firstName} ${pro.lastName}` : p.professionalAlias);
            return true;
          }
        }
      }
      return false;
    };
    if (tryOpen()) {
      deepRef.current = null;
      window.history.replaceState(null, "", window.location.pathname);
    } else if (target) {
      deepRef.current = null; // mes correcto cargado y tarjeta no encontrada: desistir
    }
  }, [loaded, plans, avisos, sedes, professionals]);

  // ── Month navigation: swipe táctil + flechas ‹ › ──
  const [slideDir, setSlideDir] = useState<"" | "next" | "prev">("");
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // ── Vista 🌉 MEDIO: final de mes + principio del siguiente ──
  const [midMode, setMidMode] = useState(false);

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
    loadedMonthRef.current = { y: year, m: month };
    // Meses vecinos: la vista 🌉 MEDIO (y los días de borde del mes normal) necesitan
    // tarjetas REALES del mes anterior y del siguiente, no solo del mes en pantalla.
    const pm = month === 0 ? 11 : month - 1, py = month === 0 ? year - 1 : year;
    const nm = month === 11 ? 0 : month + 1, ny = month === 11 ? year + 1 : year;
    const [sRes, pRes, plRes, plPrev, plNext, hRes, aRes] = await Promise.all([
      fetch("/api/company/sedes"),
      fetch("/api/company/professionals"),
      fetch(`/api/company/plan?year=${year}&month=${month}`),
      fetch(`/api/company/plan?year=${py}&month=${pm}`),
      fetch(`/api/company/plan?year=${ny}&month=${nm}`),
      fetch("/api/company/holidays"),
      fetch("/api/company/avisos"),
    ]);
    const s = sRes.ok ? await sRes.json() : [];
    const p = pRes.ok ? await pRes.json() : [];
    setSedes(s);
    setProfessionals(p);
    const [cur, prv, nxt] = await Promise.all([
      plRes.ok ? plRes.json() : Promise.resolve([]),
      plPrev.ok ? plPrev.json() : Promise.resolve([]),
      plNext.ok ? plNext.json() : Promise.resolve([]),
    ]);
    const byId = new Map<string, PlanEntry>();
    [...prv, ...nxt, ...cur].forEach((x: PlanEntry) => byId.set(x.id, x));
    setPlans([...byId.values()]);
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
  const DOW_SHORT = ["L", "M", "X", "J", "V", "S", "D"];

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

  // Resalta la palabra QUIROFANO (con o sin acento) en ROJO ESTILO LED dentro de la tarea de la sede
  const renderTaskLED = (task?: string): React.ReactNode => {
    if (!task) return "";
    const parts = task.split(/(quir[oó]fano)/i);
    return parts.map((part, i) =>
      /^quir[oó]fano$/i.test(part)
        ? <span key={i} className="led-red">{part.toUpperCase()}</span>
        : <span key={i}>{part}</span>
    );
  };

  // Carga el estado del 🔔 aviso desde una nota existente (token @N[:nombres])
  const loadAvisoState = (text: string) => {
    const av = parseAvisoToken(text || "");
    setAvisoOn(av.on);
    setAvisoDays(av.days);
    setAvisoAll(av.all);
    setAvisoSel(usersFromNames(av.names, appUsers));
    setAvisoRawNames(av.names);
    avisoRawTokenRef.current = av.raw;
  };

  const selectedNames = (): string[] | null =>
    avisoAll ? null : appUsers.filter(u => avisoSel.has(u.id)).map(u => u.name);

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
    loadAvisoState(plan.notes || "");
    setNoteText(stripAvisoToken(plan.notes || ""));
    setPlanMoveDate(plan.date);
  };

  const closeNoteEditor = () => {
    setNoteModal(null);
    setNoteText("");
  };

  const saveNote = async () => {
    if (!noteModal) return;
    setNoteSaving(true);
    try {
      const finalNote = buildAvisoNote(noteText, avisoOn, clampAvisoDays(avisoDays), selectedNames(), avisoRawTokenRef.current);
      const res = await fetch(`/api/company/plan/${noteModal.planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: finalNote }),
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
    loadAvisoState(a.note || "");
    setNoteText(stripAvisoToken(a.note || ""));
    setAvisoMoveDate(a.date);
  };

  const saveAvisoNote = async () => {
    if (!avisoNoteModal) return;
    setNoteSaving(true);
    try {
      const finalNote = buildAvisoNote(noteText, avisoOn, clampAvisoDays(avisoDays), selectedNames(), avisoRawTokenRef.current);
      const res = await fetch(`/api/company/avisos/${avisoNoteModal.avisoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: finalNote }),
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

  // ── Añadir en Mensual (turno): el diálogo se abre directo en el formulario ──
  const openAddDialog = (date: string) => {
    setAddModal({ date });
    setAddSede(filteredSedes[0]?.id || sedes[0]?.id || "");
    setAddTurn("MANANA");
    setAddPro("");
    // 🔔 la pregunta del aviso SIEMPRE visible, empezando en NO
    setAvisoOn(false); setAvisoDays(7); setAvisoAll(true); setAvisoSel(new Set());
    setAvisoRawNames([]); avisoRawTokenRef.current = "";
  };

  const savePlanAdd = async () => {
    if (!addModal || !addSede || !addPro) return;
    setAddSaving(true);
    try {
      const res = await fetch("/api/company/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sedeId: addSede, date: addModal.date, turn: addTurn, professionalAlias: addPro }),
      });
      if (!res.ok) {
        alert("No se pudo guardar el turno.");
        return;
      }
      // 🔔 si quiere AVISO, la nota del turno nuevo lleva el token @N[:nombres]
      if (avisoOn) {
        try {
          const created = await res.json();
          await fetch(`/api/company/plan/${created.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: buildAvisoNote("", true, clampAvisoDays(avisoDays), selectedNames()) }),
          });
        } catch { /* el turno ya está creado: el aviso se puede añadir en la tarjeta */ }
      }
      setAddModal(null);
      await load();
    } catch {
      alert("Error de red al guardar el turno.");
    } finally {
      setAddSaving(false);
    }
  };

  // ── Borrar / mover TARJETAS (turnos y avisos) — con mensaje de confirmación ──
  const deletePlan = async () => {
    if (!noteModal) return;
    if (!confirm(`¿Borrar el turno de ${noteModal.proName} en ${noteModal.sedeName} (${formatDateLabel(noteModal.date)})?`)) return;
    try {
      const res = await fetch(`/api/company/plan/${noteModal.planId}`, { method: "DELETE" });
      if (res.ok) {
        setPlans(prev => prev.filter(p => p.id !== noteModal.planId));
        closeNoteEditor();
      } else alert("No se pudo borrar el turno.");
    } catch { alert("Error de red al borrar el turno."); }
  };

  const movePlan = async () => {
    if (!noteModal || !planMoveDate || planMoveDate === noteModal.date) return;
    try {
      const res = await fetch(`/api/company/plan/${noteModal.planId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: planMoveDate }),
      });
      if (res.ok) { closeNoteEditor(); await load(); }
      else alert("No se pudo mover el turno.");
    } catch { alert("Error de red al mover el turno."); }
  };

  const deleteAviso = async () => {
    if (!avisoNoteModal) return;
    if (!confirm(`¿Borrar el aviso de ${avisoNoteModal.reason} (${formatDateLabel(avisoNoteModal.date)})?`)) return;
    try {
      const res = await fetch(`/api/company/avisos/${avisoNoteModal.avisoId}`, { method: "DELETE" });
      if (res.ok) {
        setAvisos(prev => prev.filter(a => a.id !== avisoNoteModal.avisoId));
        setAvisoNoteModal(null);
        setNoteText("");
      } else alert("No se pudo borrar el aviso.");
    } catch { alert("Error de red al borrar el aviso."); }
  };

  const moveAviso = async () => {
    if (!avisoNoteModal || !avisoMoveDate || avisoMoveDate === avisoNoteModal.date) return;
    try {
      const res = await fetch(`/api/company/avisos/${avisoNoteModal.avisoId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: avisoMoveDate }),
      });
      if (res.ok) { setAvisoNoteModal(null); setNoteText(""); await load(); }
      else alert("No se pudo mover el aviso.");
    } catch { alert("Error de red al mover el aviso."); }
  };

  // ── Mover tarjeta ARRASTRANDO a otro día (PC: drag & drop) ──
  const handleDrop = async (e: React.DragEvent, targetDate: string) => {
    let data: { kind?: string; id?: string } = {};
    try { data = JSON.parse(e.dataTransfer.getData("text/plain") || "{}"); } catch { return; }
    if (!data?.id || !data?.kind) return;
    const isPlan = data.kind === "plan";
    const card: PlanEntry | AvisoEntry | undefined = isPlan
      ? plans.find(p => p.id === data.id)
      : avisos.find(a => a.id === data.id);
    if (!card || card.date === targetDate) return;
    try {
      const res = await fetch(isPlan ? `/api/company/plan/${data.id}` : `/api/company/avisos/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: targetDate }),
      });
      if (res.ok) await load();
      else alert("No se pudo mover la tarjeta.");
    } catch { alert("Error de red al mover la tarjeta."); }
  };

  // ── Orden de tarjetas DENTRO de un día (manual + auto M→T→ambas) ──
  const saveDayOrder = async (date: string, list: Array<{ id: string; kind: "plan" | "aviso" }>) => {
    const items = list.map((x, i) => ({ kind: x.kind, id: x.id, order: i }));
    setPlans(prev => prev.map(p => { const it = items.find(x => x.kind === "plan" && x.id === p.id); return it ? { ...p, order: it.order } : p; }));
    setAvisos(prev => prev.map(a => { const it = items.find(x => x.kind === "aviso" && x.id === a.id); return it ? { ...a, order: it.order } : a; }));
    try {
      const res = await fetch("/api/company/cards/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, items }),
      });
      if (!res.ok) await load();
    } catch { await load(); }
  };

  const autoSortDay = async (date: string) => {
    setPlans(prev => prev.map(p => p.date === date ? { ...p, order: -1 } : p));
    setAvisos(prev => prev.map(a => a.date === date ? { ...a, order: -1 } : a));
    try {
      const res = await fetch("/api/company/cards/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, auto: true }),
      });
      if (!res.ok) await load();
    } catch { await load(); }
  };

  // Soltar una tarjeta SOBRE otra: si es del mismo día → reordenar; si viene de otro día → mover fecha
  const reorderInDay = (e: React.DragEvent, date: string, targetId: string, targetKind: "plan" | "aviso", dayList: Array<{ id: string; kind: "plan" | "aviso" }>) => {
    let data: { kind?: string; id?: string } = {};
    try { data = JSON.parse(e.dataTransfer.getData("text/plain") || "{}"); } catch { return; }
    if (!data?.id || !data?.kind || (data.kind !== "plan" && data.kind !== "aviso")) return;
    e.preventDefault();
    e.stopPropagation();
    const dragged: PlanEntry | AvisoEntry | undefined = data.kind === "plan"
      ? plans.find(p => p.id === data.id)
      : avisos.find(a => a.id === data.id);
    if (!dragged) return;
    if (dragged.date !== date) { handleDrop(e, date); return; }
    const from = dayList.findIndex(x => x.kind === data.kind && x.id === data.id);
    const to = dayList.findIndex(x => x.kind === targetKind && x.id === targetId);
    if (from < 0 || to < 0 || from === to) return;
    const list = dayList.map(x => ({ id: x.id, kind: x.kind }));
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    saveDayOrder(date, list);
  };

  // ── Días a renderizar: mes normal o ventana 🌉 MEDIO (28 días: final de mes + principio del siguiente) ──
  const MESES_SHORT = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  type ViewDay = { dateObj: Date; f: string; day: number; monthTag: string | null; adj?: boolean };
  const viewDays: ViewDay[] = [];
  if (midMode) {
    const anchor = Math.max(1, totalDays - 13); // ~2 semanas antes de fin de mes
    const back = (new Date(year, month, anchor).getDay() + 6) % 7; // días desde el lunes
    const start = new Date(year, month, anchor - back);
    for (let i = 0; i < 28; i++) {
      const dObj = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      viewDays.push({ dateObj: dObj, f: fmt(dObj), day: dObj.getDate(), monthTag: MESES_SHORT[dObj.getMonth()] });
    }
  } else {
    // Mes normal + días REALES de los meses vecinos: al pasar de mes siempre se ve
    // el final del anterior y el principio del siguiente (con sus tarjetas).
    const pm2 = month === 0 ? 11 : month - 1, py2 = month === 0 ? year - 1 : year;
    const nm2 = month === 11 ? 0 : month + 1, ny2 = month === 11 ? year + 1 : year;
    const prevTotal = new Date(py2, pm2 + 1, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      const dObj = new Date(py2, pm2, prevTotal - i);
      viewDays.push({ dateObj: dObj, f: fmt(dObj), day: dObj.getDate(), monthTag: MESES_SHORT[pm2], adj: true });
    }
    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(year, month, day);
      viewDays.push({ dateObj, f: fmt(dateObj), day, monthTag: null });
    }
    const trail = (7 - ((startWeekday + totalDays) % 7)) % 7;
    for (let day = 1; day <= trail; day++) {
      const dObj = new Date(ny2, nm2, day);
      viewDays.push({ dateObj: dObj, f: fmt(dObj), day, monthTag: MESES_SHORT[nm2], adj: true });
    }
  }

  const cells: React.ReactNode[] = [];

  for (const vd of viewDays) {
    const dateObj = vd.dateObj;
    const day = vd.day;
    const f = vd.f;
    const we = isWE(dateObj);
    const fest = isFestivo(f);
    const festProvs = getFestivoProvinces(f);

    // Tarjetas del día con orden: manual (order>=0) primero; después AUTO mañanas → tardes → ambas
    type DayCard = { id: string; kind: "plan" | "aviso"; sortKey: number; node: React.ReactNode };
    const dayCards: DayCard[] = [];
    filteredSedes.forEach(sede => {
      const sedeIdx = sedes.findIndex(x => x.id === sede.id);
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
        const cleanNote = stripAvisoToken(p.notes || "");
        const notePreview = cleanNote || (AVISO_TOKEN_RE.test(p.notes || "") ? "🔔 aviso programado" : "");
        // Truncate tooltip preview
        const tooltipLines = [
          `${sede.name} / ${sede.task} · ${p.turn === "MANANA" ? "Mañana" : "Tarde"} · ${nombre}`,
          hasNote ? `📝 ${notePreview.length > 200 ? notePreview.slice(0, 200) + "…" : notePreview}` : "Click: nota · mover · borrar",
        ].join("\n");
        const turnGroup = p.turn === "MANANA" ? 0 : 1;
        const order = typeof p.order === "number" && p.order >= 0 ? p.order : -1;
        const sortKey = order >= 0 ? order : 1000 + turnGroup * 100 + Math.max(0, sedeIdx) * 2;
        dayCards.push({
          id: p.id,
          kind: "plan",
          sortKey,
          node: (
          <div
            key={p.id}
            onClick={(e) => { e.stopPropagation(); openNoteEditor(p, sede, nombre); }}
            draggable
            onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "plan", id: p.id })); e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => reorderInDay(e, f, p.id, "plan", dayCards)}
            className="text-[1em] px-1 py-0.5 rounded font-bold leading-tight border border-black/10 break-words cursor-pointer hover:ring-2 hover:ring-amber-500 hover:ring-offset-0 transition relative"
            style={{ background: sede.color, color: textColorFor(sede.color) }}
            title={tooltipLines}
          >
            <span className="inline-block font-black px-0.5 mr-0.5 bg-black/80 text-white rounded-[2px]">{turnLabel}</span>
            {sede.name} / {renderTaskLED(sede.task)} - {nombre}
            {hasNote && (
              <span
                className="absolute top-0 right-0 -mt-1 -mr-1 text-[10px] bg-amber-400 text-black rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold border border-black/60 leading-none"
                title="Tiene nota"
              >•</span>
            )}
          </div>
          ),
        });
      });
    });

    // ── Vacation / absence cards (avisos) — siempre visibles ──
    {
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
        const cleanNote = stripAvisoToken(a.note || "");
        const notePreview = cleanNote || (AVISO_TOKEN_RE.test(a.note || "") ? "🔔 aviso programado" : "");
        const turnGroupA = a.turn === "M" ? 0 : a.turn === "T" ? 1 : 2; // "" = ambas → última
        const orderA = typeof a.order === "number" && a.order >= 0 ? a.order : -1;
        const sedeIdxA = sedes.findIndex(x => x.id === a.sedeId);
        const sortKeyA = orderA >= 0 ? orderA : 1000 + turnGroupA * 100 + Math.max(0, sedeIdxA) * 2 + 1;
        dayCards.push({
          id: a.id,
          kind: "aviso",
          sortKey: sortKeyA,
          node: (
          <div
            key={`av-${a.id}`}
            onClick={(e) => { e.stopPropagation(); openAvisoNoteEditor(a); }}
            draggable
            onDragStart={(e) => { e.dataTransfer.setData("text/plain", JSON.stringify({ kind: "aviso", id: a.id })); e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => reorderInDay(e, f, a.id, "aviso", dayCards)}
            className="text-[1em] px-1 py-0.5 rounded font-bold leading-tight border border-red-900/40 break-words cursor-pointer hover:ring-2 hover:ring-red-500 hover:ring-offset-0 transition relative"
            style={{
              background: "repeating-linear-gradient(45deg, #fee2e2, #fee2e2 5px, #fecaca 5px, #fecaca 10px)",
              color: "#7f1d1d",
            }}
            title={[
              `${reason}${proName ? ` · ${proName}` : ""}${sede ? ` · ${sede.name}` : ""}${a.turn ? ` · ${a.turn === "M" ? "Mañana" : "Tarde"}` : ""}`,
              hasNote ? `📝 ${notePreview.length > 200 ? notePreview.slice(0, 200) + "…" : notePreview}` : "Click: nota · mover · borrar el aviso",
            ].join("\n")}
          >
            {turnLabel && <span className="inline-block font-black px-0.5 mr-0.5 bg-red-900 text-white rounded-[2px]">{turnLabel}</span>}
            <span className="font-black">🏖 {reason}</span>
            {proName ? ` - ${avisoProAlias || proName}` : ""}
            {sede ? (
              <> ({sede.name}{sede.task ? <> / {renderTaskLED(sede.task)}</> : null})</>
            ) : ""}
            {hasNote && (
              <span
                className="absolute top-0 right-0 -mt-1 -mr-1 text-[10px] bg-amber-400 text-black rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold border border-black/60 leading-none"
                title="Tiene nota"
              >•</span>
            )}
          </div>
          ),
        });
      });
    }

    // Orden final del día: manual primero (por orden guardado), luego AUTO M→T→ambas
    dayCards.sort((x, y) => x.sortKey - y.sortKey || x.id.localeCompare(y.id));
    const assigns = dayCards.map(c => c.node);

    const tdClass = vd.adj ? "bg-gray-100" : fest ? "bg-red-100" : we ? "bg-purple-50" : "bg-gray-50";
    cells.push(
      <td
        key={vd.f}
        className={`border border-gray-300 h-auto min-h-[96px] sm:min-h-[110px] p-1 align-top ${tdClass}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleDrop(e, f); }}
      >
        <div className="font-black text-[11px] sm:text-[13px] text-gray-900 flex justify-between items-center gap-0.5 sm:gap-1">
          <span className={vd.adj ? "text-gray-400" : "text-gray-900"}>{day}{vd.monthTag && <span className="ml-0.5 text-[7px] sm:text-[8px] font-bold text-gray-500 align-top">{vd.monthTag}</span>}</span>
          <div className="flex items-center gap-1 min-w-0">
            {fest && (
              <span title={`Festivo · ${festProvs.join(", ")}`} className="text-[7px] sm:text-[8px] font-black bg-red-700 text-white px-1 py-0.5 rounded truncate max-w-[30px] sm:max-w-none">
                <span className="sm:hidden">FEST</span>
                <span className="hidden sm:inline">FESTIVO · {festProvs.join(", ")}</span>
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); autoSortDay(f); }}
              className="no-print shrink-0 h-5 w-5 rounded-full bg-gray-200 text-gray-700 text-[11px] font-black leading-none items-center justify-center hover:bg-amber-500 hover:text-black active:scale-90 transition hidden sm:flex"
              title="Ordenar automáticamente: mañanas → tardes → ambas"
            >⇅</button>
            <button
              onClick={(e) => { e.stopPropagation(); openAddDialog(f); }}
              className="no-print shrink-0 h-5 w-5 rounded-full bg-gray-900 text-white text-[13px] font-black leading-none items-center justify-center hover:bg-amber-500 hover:text-black active:scale-90 transition hidden sm:flex"
              title="Programar turno este día"
            >+</button>
            <button
              onClick={(e) => { e.stopPropagation(); openAddDialog(f); }}
              className="no-print sm:hidden shrink-0 h-5 w-5 rounded-full bg-gray-900/85 text-white text-[12px] font-black leading-none flex items-center justify-center active:scale-90 transition"
              title="Programar turno este día"
            >+</button>
          </div>
        </div>
        <div className="flex flex-col gap-0.5 mt-1">{assigns}</div>
      </td>
    );
  }

  while (!midMode && cells.length % 7 !== 0) cells.push(<td key={`te${cells.length}`} className="border border-gray-300 bg-gray-100" />);

  const rows: React.ReactNode[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(<tr key={i}>{cells.slice(i, i + 7)}</tr>);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-2 sm:p-3 mb-2 sm:mb-3 shrink-0 no-print">
        {/* Barra compacta (móvil/tablet ≤959px, controlada por JS): mes + filtros desplegables.
            Al girar el móvil a horizontal NO se despliegan solos. */}
        <div className={`${isCompact ? "flex" : "hidden"} items-center gap-2`}>
          <button onClick={() => goMonth(-1)} className="h-9 w-9 shrink-0 rounded-full bg-slate-900 border border-slate-600 text-white text-lg font-black flex items-center justify-center active:scale-90 transition" title="Mes anterior">‹</button>
          <div className="flex-1 text-center font-black text-white text-sm truncate">{midMode ? `${MESES[month].slice(0, 3).toUpperCase()} → ${MESES[(month + 1) % 12].slice(0, 3).toUpperCase()}` : MESES[month].toUpperCase()} {year}</div>
          <button onClick={() => goMonth(1)} className="h-9 w-9 shrink-0 rounded-full bg-slate-900 border border-slate-600 text-white text-lg font-black flex items-center justify-center active:scale-90 transition" title="Mes siguiente">›</button>
          <button onClick={() => setMidMode(m => !m)} className={`shrink-0 h-9 px-2.5 rounded-lg text-base leading-none flex items-center transition ${midMode ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-slate-700 hover:bg-slate-600 text-white"}`} title="Fin de un mes + principio del siguiente">🌉</button>
          <button onClick={() => setFiltersOpen(o => !o)} className="shrink-0 bg-slate-700 hover:bg-slate-600 text-white font-black px-3 py-2 rounded-lg text-xs transition">
            {filtersOpen ? "✕ CERRAR" : "⚙️ FILTROS"}
          </button>
        </div>

        {/* Filtros: ocultos hasta pulsar ⚙️ FILTROS (móvil/tablet); siempre visibles en PC */}
        <div className={`${isCompact ? (filtersOpen ? "flex" : "hidden") : "flex"} gap-2 sm:gap-3 items-end flex-wrap ${filtersOpen && isCompact ? "mt-3" : ""}`}>
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
        <button onClick={() => setMidMode(m => !m)} className={`font-black px-3 py-2 rounded-lg text-xs transition ${midMode ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-slate-700 hover:bg-slate-600 text-white"}`} title="Ver el final del mes y el principio del siguiente">🌉 MEDIO</button>
        <button onClick={() => { setSlideDir(""); setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); }} className="bg-amber-500 hover:bg-amber-400 text-black font-black px-3 py-2 rounded-lg text-xs transition">HOY</button>
        <button onClick={() => window.print()} className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-2 rounded-lg text-xs transition">🖨️ PDF</button>
      </div>
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
            <h1 className="text-base sm:text-xl font-black text-gray-900 whitespace-nowrap">{midMode ? `${MESES[month].slice(0, 3).toUpperCase()} → ${MESES[(month + 1) % 12].slice(0, 3).toUpperCase()}` : MESES[month].toUpperCase()} {year}</h1>
            <button
              onClick={() => goMonth(1)}
              className="no-print h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-full bg-gray-100 hover:bg-amber-500 hover:text-black text-gray-700 text-xl font-black flex items-center justify-center transition"
              title="Mes siguiente (desliza a la izquierda)"
            >›</button>
          </div>
          <span className="text-[10px] text-gray-500 font-bold hidden sm:block">+ turno · ⇅ ordena el día (M→T→ambas) · arrastra sobre otra tarjeta: ordenar · arrastra a otro día: mover</span>
        </div>
        <div className="sm:hidden text-center text-[10px] text-gray-400 font-bold mb-2 no-print">
          Desliza ‹ › para cambiar de mes · 🌉 = final de un mes y principio del siguiente
        </div>
        <div key={`${year}-${month}`} className={slideDir === "next" ? "month-anim-next" : slideDir === "prev" ? "month-anim-prev" : ""}>
        <table className="w-full border-collapse table-fixed auto-text">
          <thead>
            <tr>
              {DOW_HEADER.map((d, i) => (
                <th key={i} className={`py-1.5 sm:py-2 auto-dow font-bold text-center border border-gray-900 ${i >= 5 ? "bg-purple-900" : "bg-gray-900"}`} style={{ color: "#fff" }}>
                  <span className="sm:hidden">{DOW_SHORT[i]}</span>
                  <span className="hidden sm:inline">{d}</span>
                </th>
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
                placeholder="Escribe aquí la nota del aviso… (💡 @5 = te avisamos 5 días antes)"
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
            <div>
              <label className="block text-[11px] font-extrabold text-gray-700 uppercase mb-1.5">MOVER A OTRO DÍA</label>
              <div className="flex gap-2">
                <input type="date" value={avisoMoveDate} onChange={e => setAvisoMoveDate(e.target.value)} className="flex-1 px-2 py-2 bg-gray-50 border-2 border-gray-300 focus:border-amber-500 rounded-lg text-sm text-gray-900" />
                <button onClick={moveAviso} disabled={noteSaving || !avisoMoveDate || avisoMoveDate === avisoNoteModal.date}
                  className="px-3 py-2 bg-gray-900 hover:bg-black disabled:opacity-40 text-white rounded-lg font-bold text-xs transition whitespace-nowrap"
                  title="Mover esta tarjeta de aviso al día elegido">→ MOVER</button>
              </div>
            </div>
            <AvisoPicker
              users={appUsers}
              on={avisoOn} days={avisoDays} all={avisoAll} sel={avisoSel}
              setOn={setAvisoOn} setDays={setAvisoDays} setAll={setAvisoAll} setSel={setAvisoSel}
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={deleteAviso}
                disabled={noteSaving}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-black text-sm transition disabled:opacity-50"
                title="Borrar esta tarjeta de aviso"
              >🗑 BORRAR</button>
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
                placeholder="Escribe aquí la nota (visible en tooltip al pasar el ratón)… (💡 @5 = te avisamos 5 días antes)"
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
            <div>
              <label className="block text-[11px] font-extrabold text-gray-700 uppercase mb-1.5">MOVER A OTRO DÍA</label>
              <div className="flex gap-2">
                <input type="date" value={planMoveDate} onChange={e => setPlanMoveDate(e.target.value)} className="flex-1 px-2 py-2 bg-gray-50 border-2 border-gray-300 focus:border-amber-500 rounded-lg text-sm text-gray-900" />
                <button onClick={movePlan} disabled={noteSaving || !planMoveDate || planMoveDate === noteModal.date}
                  className="px-3 py-2 bg-gray-900 hover:bg-black disabled:opacity-40 text-white rounded-lg font-bold text-xs transition whitespace-nowrap"
                  title="Mover esta tarjeta de turno al día elegido">→ MOVER</button>
              </div>
            </div>
            <AvisoPicker
              users={appUsers}
              on={avisoOn} days={avisoDays} all={avisoAll} sel={avisoSel}
              setOn={setAvisoOn} setDays={setAvisoDays} setAll={setAvisoAll} setSel={setAvisoSel}
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={deletePlan}
                disabled={noteSaving}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-black text-sm transition disabled:opacity-50"
                title="Borrar esta tarjeta de turno"
              >🗑 BORRAR</button>
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

      {/* ═══ Añadir turno o aviso (botón + del día) ═══ */}
      {addModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setAddModal(null)}
        >
          <div
            className="bg-white border-2 border-gray-900 rounded-xl p-4 sm:p-6 w-full max-w-md space-y-4 shadow-2xl max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="border-b-2 border-gray-900 pb-2">
              <h3 className="text-gray-900 font-black text-lg">👷 Programar turno</h3>
              <p className="text-[11px] text-gray-600 font-bold uppercase tracking-wide">{formatDateLabel(addModal.date)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-extrabold text-gray-700 uppercase mb-1.5">SEDE</label>
                <select value={addSede} onChange={e => setAddSede(e.target.value)} className="w-full px-2 py-2 bg-gray-50 border-2 border-gray-300 focus:border-amber-500 rounded-lg text-sm text-gray-900">
                  {sedes.map(s => <option key={s.id} value={s.id}>{s.name}{s.task ? ` / ${s.task}` : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-gray-700 uppercase mb-1.5">TURNO</label>
                <div className="flex gap-1.5">
                  <button onClick={() => setAddTurn("MANANA")} className={`flex-1 py-2 rounded-lg font-bold text-xs border transition ${addTurn === "MANANA" ? "bg-gray-900 text-white border-gray-900" : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"}`}>Mañana</button>
                  <button onClick={() => setAddTurn("TARDE")} className={`flex-1 py-2 rounded-lg font-bold text-xs border transition ${addTurn === "TARDE" ? "bg-gray-900 text-white border-gray-900" : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"}`}>Tarde</button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-gray-700 uppercase mb-1.5">PROFESIONAL</label>
              <select value={addPro} onChange={e => setAddPro(e.target.value)} className="w-full px-2 py-2 bg-gray-50 border-2 border-gray-300 focus:border-amber-500 rounded-lg text-sm text-gray-900">
                <option value="">— Selecciona —</option>
                {professionals.map(p => <option key={p.id} value={p.alias}>{p.alias} - {p.firstName} {p.lastName}</option>)}
              </select>
            </div>
            {/* 🔔 LA PREGUNTA: ¿crear notificación? → a quién + días antes */}
            <AvisoPicker
              users={appUsers}
              on={avisoOn} days={avisoDays} all={avisoAll} sel={avisoSel}
              setOn={setAvisoOn} setDays={setAvisoDays} setAll={setAvisoAll} setSel={setAvisoSel}
            />
            <div className="flex gap-2 pt-2">
              <button onClick={() => setAddModal(null)} disabled={addSaving} className="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-bold text-sm transition disabled:opacity-50">Cancelar</button>
              <button onClick={savePlanAdd} disabled={addSaving || !addSede || !addPro} className="flex-1 py-2 px-4 bg-gray-900 hover:bg-black text-white rounded-lg font-bold text-sm transition disabled:opacity-50">{addSaving ? "Guardando…" : "Añadir turno"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
