"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

// ───────────────────────────────────────────────────────────
// Permission catalog (mirrors server-side PERM_KEYS in /api/company/permissions)
// ───────────────────────────────────────────────────────────
type PermKey =
  | "view_diario" | "edit_diario"
  | "view_mensual" | "edit_mensual"
  | "view_sedes" | "edit_sedes"
  | "view_own_only" | "view_assigned_sedes"
  | "can_print" | "can_send"
  | "can_voice_avisos";

type Perms = Record<PermKey, boolean>;

const PERM_GROUPS: {
  title: string;
  perms: { key: PermKey; label: string; help: string }[];
}[] = [
  {
    title: "Diario",
    perms: [
      { key: "view_diario", label: "Ver diario", help: "Puede abrir la vista Diaria" },
      { key: "edit_diario", label: "Editar diario", help: "Puede asignar / modificar turnos en el diario" },
    ],
  },
  {
    title: "Mensual",
    perms: [
      { key: "view_mensual", label: "Ver mensual", help: "Puede abrir la vista Mensual" },
      { key: "edit_mensual", label: "Editar mensual", help: "Puede modificar el calendario mensual" },
    ],
  },
  {
    title: "Sedes",
    perms: [
      { key: "view_sedes", label: "Ver sedes", help: "Puede ver la lista de sedes" },
      { key: "edit_sedes", label: "Editar sedes", help: "Puede crear / editar / borrar sedes" },
    ],
  },
  {
    title: "Filtros",
    perms: [
      { key: "view_own_only", label: "Solo sus turnos", help: "Solo ve los turnos asignados a su alias" },
      { key: "view_assigned_sedes", label: "Solo sus sedes", help: "Solo ve las sedes que tiene asignadas" },
    ],
  },
  {
    title: "Acciones",
    perms: [
      { key: "can_print", label: "Imprimir", help: "Puede imprimir el diario / mensual" },
      { key: "can_send", label: "Enviar", help: "Puede enviar por email el diario / mensual" },
      { key: "can_voice_avisos", label: "🎙️ Avisos por voz", help: "Puede añadir avisos de vacaciones/ausencias dictando por voz o escribiéndolos" },
    ],
  },
];

const ALL_PERM_KEYS: PermKey[] = PERM_GROUPS.flatMap(g => g.perms.map(p => p.key));

function emptyPerms(): Perms {
  const o = {} as Perms;
  for (const k of ALL_PERM_KEYS) o[k] = false;
  return o;
}

// ── Mensual view restrictions (per access) ──
type ViewRestrictions = {
  sedesAll: boolean;        // true = can see ALL sedes
  sedes: Set<string>;       // sede names (when !sedesAll)
  prosAll: boolean;         // true = can see ALL professionals
  pros: Set<string>;        // pro aliases (when !prosAll)
  showNotes: boolean;
  showVacaciones: boolean;
};

function parseAllowed(csv: string): { all: boolean; set: Set<string> } {
  const items = (csv || "").split(",").map(s => s.trim()).filter(Boolean);
  return { all: items.length === 0, set: new Set(items) };
}

type Row = {
  professional: {
    id: string; firstName: string; lastName: string; alias: string;
    email: string; phone: string; assignedSedes: string;
  };
  user: {
    id: string; email: string; name: string;
    isActive: boolean; hasPassword: boolean;
    permissions: Perms;
    allowedSedes: string;
    allowedPros: string;
    showNotes: boolean;
    showVacaciones: boolean;
  } | null;
  canLogin: boolean;
};

type Draft = {
  email: string;
  canLogin: boolean;
  password: string;        // new password typed ("" = unchanged)
  passwordCleared: boolean;
  perms: Perms;
  vr: ViewRestrictions;
  dirty: boolean;
};

export default function ConfigTab() {
  const { data: session } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [sedes, setSedes] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [r, sRes, pRes] = await Promise.all([
        fetch("/api/company/permissions"),
        fetch("/api/company/sedes"),
        fetch("/api/company/professionals"),
      ]);
      if (!r.ok) { showToast("Error al cargar permisos", "error"); return; }
      const data: Row[] = await r.json();
      setRows(data);
      if (sRes.ok) setSedes(await sRes.json());
      if (pRes.ok) setProfessionals(await pRes.json());
      const next: Record<string, Draft> = {};
      for (const row of data) {
        const sedesAllowed = parseAllowed(row.user?.allowedSedes || "");
        const prosAllowed = parseAllowed(row.user?.allowedPros || "");
        next[row.professional.id] = {
          email: row.user?.email || row.professional.email || "",
          canLogin: !!row.canLogin,
          password: "",
          passwordCleared: false,
          perms: row.user?.permissions || emptyPerms(),
          vr: {
            sedesAll: sedesAllowed.all,
            sedes: sedesAllowed.set,
            prosAll: prosAllowed.all,
            pros: prosAllowed.set,
            showNotes: row.user?.showNotes !== false,
            showVacaciones: row.user?.showVacaciones !== false,
          },
          dirty: false,
        };
      }
      setDrafts(next);
    } catch {
      showToast("Error de conexión", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const updateDraft = (proId: string, patch: Partial<Draft>) => {
    setDrafts(prev => ({
      ...prev,
      [proId]: { ...prev[proId], ...patch, dirty: true },
    }));
  };

  const togglePerm = (proId: string, key: PermKey, value: boolean) => {
    setDrafts(prev => {
      const d = prev[proId];
      if (!d) return prev;
      const perms = { ...d.perms, [key]: value };
      // Auto-cascade: enabling edit implies enabling view
      if (key.startsWith("edit_") && value) {
        const viewKey = ("view_" + key.slice(5)) as PermKey;
        perms[viewKey] = true;
      }
      // Disabling view forces disabling edit
      if (key.startsWith("view_") && !value) {
        const editKey = ("edit_" + key.slice(5)) as PermKey;
        perms[editKey] = false;
      }
      return { ...prev, [proId]: { ...d, perms, dirty: true } };
    });
  };

  const toggleVrSede = (proId: string, sedeName: string) => {
    setDrafts(prev => {
      const d = prev[proId];
      if (!d) return prev;
      const n = new Set(d.vr.sedes);
      if (n.has(sedeName)) n.delete(sedeName); else n.add(sedeName);
      return { ...prev, [proId]: { ...d, vr: { ...d.vr, sedes: n, sedesAll: n.size === 0 }, dirty: true } };
    });
  };

  const toggleVrPro = (proId: string, alias: string) => {
    setDrafts(prev => {
      const d = prev[proId];
      if (!d) return prev;
      const n = new Set(d.vr.pros);
      if (n.has(alias)) n.delete(alias); else n.add(alias);
      return { ...prev, [proId]: { ...d, vr: { ...d.vr, pros: n, prosAll: n.size === 0 }, dirty: true } };
    });
  };

  const save = async (proId: string) => {
    const draft = drafts[proId];
    if (!draft) return;
    if (draft.canLogin && draft.email && !draft.email.includes("@")) {
      showToast("Email inválido", "error");
      return;
    }
    if (draft.password && draft.password.trim().length < 4) {
      showToast("La contraseña debe tener al menos 4 caracteres", "error");
      return;
    }
    setSavingId(proId);
    try {
      const body: Record<string, unknown> = {
        professionalId: proId,
        canLogin: draft.canLogin,
        email: draft.email,
        view_diario: draft.perms.view_diario,
        edit_diario: draft.perms.edit_diario,
        view_mensual: draft.perms.view_mensual,
        edit_mensual: draft.perms.edit_mensual,
        view_sedes: draft.perms.view_sedes,
        edit_sedes: draft.perms.edit_sedes,
        view_own_only: draft.perms.view_own_only,
        view_assigned_sedes: draft.perms.view_assigned_sedes,
        can_print: draft.perms.can_print,
        can_send: draft.perms.can_send,
        can_voice_avisos: draft.perms.can_voice_avisos,
        allowedSedes: draft.vr.sedesAll ? "" : [...draft.vr.sedes].join(","),
        allowedPros: draft.vr.prosAll ? "" : [...draft.vr.pros].join(","),
        showNotes: draft.vr.showNotes,
        showVacaciones: draft.vr.showVacaciones,
      };
      if (draft.password) {
        body.password = draft.password;
      } else if (draft.passwordCleared) {
        body.passwordCleared = true;
      }

      const r = await fetch("/api/company/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({ error: "Error al guardar" }));
        showToast(d.error || "Error al guardar", "error");
        return;
      }
      showToast("Acceso y permisos guardados correctamente");
      setDrafts(prev => ({
        ...prev,
        [proId]: { ...prev[proId], password: "", passwordCleared: false, dirty: false },
      }));
      load();
    } catch {
      showToast("Error de conexión al guardar", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-bold transition-all ${
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className="text-2xl">⚙️</div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-white">Configuración de Accesos</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Crea contraseñas de entrada y define permisos específicos para cada profesional: qué pestañas ve, qué sedes y profesionales salen en el mensual, notas y vacaciones.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] sm:text-xs">
          <span className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-300 font-bold uppercase tracking-wider">
            {rows.filter(r => drafts[r.professional.id]?.canLogin).length} acceso(s) activo(s)
          </span>
          <span className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-300 font-bold uppercase tracking-wider">
            {rows.length} profesionales
          </span>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
          Cargando profesionales...
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
          No hay profesionales registrados. Crea profesionales primero en la pestaña Profesionales.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const pro = row.professional;
            const draft = drafts[pro.id] || {
              email: "", canLogin: false, password: "", passwordCleared: false,
              perms: emptyPerms(), vr: { sedesAll: true, sedes: new Set(), prosAll: true, pros: new Set(), showNotes: true, showVacaciones: true }, dirty: false,
            };
            const expanded = expandedId === pro.id;
            const activePerms = ALL_PERM_KEYS.filter(k => draft.perms[k]).length;

            return (
              <div key={pro.id} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                {/* Collapsed row */}
                <div
                  className="flex items-center gap-3 p-3 sm:p-4 cursor-pointer hover:bg-slate-700/30 transition"
                  onClick={() => setExpandedId(expanded ? null : pro.id)}
                >
                  <div className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                    draft.canLogin ? "bg-emerald-600 text-white" : "bg-slate-700 text-slate-400"
                  }`}>
                    {(pro.firstName[0] || "?").toUpperCase()}{(pro.lastName[0] || "").toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm sm:text-base truncate">
                        {pro.firstName} {pro.lastName}
                      </span>
                      <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded font-bold text-slate-300">
                        {pro.alias}
                      </span>
                      {draft.canLogin ? (
                        <span className="text-[10px] bg-emerald-600/20 px-1.5 py-0.5 rounded font-bold text-emerald-400 border border-emerald-600/30">
                          ACCESO ACTIVO
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-700/50 px-1.5 py-0.5 rounded font-bold text-slate-500 border border-slate-700">
                          SIN ACCESO
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 truncate">
                      {draft.email || <span className="italic text-amber-400">Sin email</span>}
                      {row.user?.hasPassword && draft.canLogin && <span className="text-blue-400 ml-2">· contraseña activa</span>}
                      {activePerms > 0 && <span className="ml-2">· {activePerms} permiso(s)</span>}
                      {!draft.vr.sedesAll && <span className="ml-2 text-amber-400">· {draft.vr.sedes.size} sede(s)</span>}
                      {!draft.vr.prosAll && <span className="ml-2 text-amber-400">· {draft.vr.pros.size} pro(s)</span>}
                    </div>
                  </div>

                  <div className="text-slate-400 text-xs shrink-0">
                    {expanded ? "▲" : "▼"}
                  </div>
                </div>

                {/* Expanded panel */}
                {expanded && (
                  <div className="border-t border-slate-700 p-3 sm:p-5 space-y-4 bg-slate-900/40">
                    {/* Login enable + email + password */}
                    <div className="grid sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-4">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={draft.canLogin}
                            onChange={e => updateDraft(pro.id, { canLogin: e.target.checked })}
                            className="h-4 w-4 accent-emerald-500"
                          />
                          <span className="text-xs font-extrabold text-emerald-400 uppercase">Puede iniciar sesión</span>
                        </label>
                        <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                          Si está activado, este profesional puede entrar tecleando su contraseña en el login.
                        </p>
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Email (identificador)</label>
                        <input
                          type="email"
                          value={draft.email}
                          onChange={e => updateDraft(pro.id, { email: e.target.value })}
                          disabled={!draft.canLogin}
                          placeholder="profesional@clinica.com (opcional)"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-xs font-extrabold text-amber-400 uppercase mb-1">Contraseña de entrada</label>
                        <input
                          type="text"
                          value={draft.password}
                          onChange={e => updateDraft(pro.id, { password: e.target.value, passwordCleared: false })}
                          disabled={!draft.canLogin}
                          placeholder={row.user?.hasPassword ? "•••••• (escribir nueva para cambiar)" : "Contraseña (mín. 4 caracteres)"}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                        {row.user?.hasPassword && !draft.password && !draft.passwordCleared && (
                          <div className="text-[10px] text-blue-400 mt-1 font-bold">Contraseña activa configurada</div>
                        )}
                        {draft.password && (
                          <div className="text-[10px] text-amber-400 mt-1 font-bold">Se establecerá esta contraseña al guardar</div>
                        )}
                      </div>
                    </div>

                    {/* ── Vista Mensual restrictions ── */}
                    <div className="bg-slate-800/60 border border-amber-600/30 rounded-lg p-3">
                      <h4 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider mb-1">
                        Vista Mensual — qué puede ver este acceso
                      </h4>
                      <p className="text-[10px] text-slate-500 mb-3 leading-tight">
                        Elige de qué sedes y de qué profesionales se ven las tarjetas en el calendario mensual, y si se muestran las notas y las vacaciones/ausencias. Si no marcas nada en una lista, las verá todas.
                      </p>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Sedes visibility */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-extrabold text-slate-300 uppercase">Sedes visibles</span>
                            <span className="text-[10px] text-amber-400 font-bold">
                              {draft.vr.sedesAll ? "TODAS" : `${draft.vr.sedes.size} seleccionada(s)`}
                            </span>
                          </div>
                          <div className="max-h-[140px] overflow-y-auto bg-slate-900/60 border border-slate-700 rounded p-2 space-y-1">
                            {sedes.map(s => (
                              <label key={s.id} className="flex items-center gap-2 px-1.5 py-1 cursor-pointer hover:bg-slate-800 rounded">
                                <input
                                  type="checkbox"
                                  checked={draft.vr.sedesAll || draft.vr.sedes.has(s.name)}
                                  disabled={draft.vr.sedesAll || !draft.canLogin}
                                  onChange={() => toggleVrSede(pro.id, s.name)}
                                  className="accent-amber-500 w-3.5 h-3.5"
                                />
                                <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: s.color }} />
                                <span className="text-[11px] font-bold text-white truncate">{s.name}</span>
                                <span className="text-[9px] text-slate-500 truncate">{s.task}</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex gap-1 mt-1.5">
                            <button
                              type="button"
                              disabled={!draft.canLogin}
                              onClick={() => updateDraft(pro.id, { vr: { ...draft.vr, sedesAll: true, sedes: new Set() } })}
                              className="flex-1 bg-slate-800 hover:bg-amber-500 hover:text-black disabled:opacity-40 text-[10px] px-2 py-1 rounded font-bold transition"
                            >TODAS LAS SEDES</button>
                            <button
                              type="button"
                              disabled={!draft.canLogin}
                              onClick={() => updateDraft(pro.id, { vr: { ...draft.vr, sedesAll: false } })}
                              className="flex-1 bg-slate-800 hover:bg-amber-500 hover:text-black disabled:opacity-40 text-[10px] px-2 py-1 rounded font-bold transition"
                            >ELEGIR…</button>
                          </div>
                        </div>

                        {/* Professionals visibility */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-extrabold text-slate-300 uppercase">Profesionales visibles</span>
                            <span className="text-[10px] text-amber-400 font-bold">
                              {draft.vr.prosAll ? "TODOS" : `${draft.vr.pros.size} seleccionado(s)`}
                            </span>
                          </div>
                          <div className="max-h-[140px] overflow-y-auto bg-slate-900/60 border border-slate-700 rounded p-2 space-y-1">
                            {professionals.map(p => (
                              <label key={p.id} className="flex items-center gap-2 px-1.5 py-1 cursor-pointer hover:bg-slate-800 rounded">
                                <input
                                  type="checkbox"
                                  checked={draft.vr.prosAll || draft.vr.pros.has(p.alias)}
                                  disabled={draft.vr.prosAll || !draft.canLogin}
                                  onChange={() => toggleVrPro(pro.id, p.alias)}
                                  className="accent-amber-500 w-3.5 h-3.5"
                                />
                                <span className="text-[11px] font-bold text-white">{p.alias}</span>
                                <span className="text-[9px] text-slate-500 truncate">{p.firstName} {p.lastName}</span>
                              </label>
                            ))}
                          </div>
                          <div className="flex gap-1 mt-1.5">
                            <button
                              type="button"
                              disabled={!draft.canLogin}
                              onClick={() => updateDraft(pro.id, { vr: { ...draft.vr, prosAll: true, pros: new Set() } })}
                              className="flex-1 bg-slate-800 hover:bg-amber-500 hover:text-black disabled:opacity-40 text-[10px] px-2 py-1 rounded font-bold transition"
                            >TODOS LOS PROFESIONALES</button>
                            <button
                              type="button"
                              disabled={!draft.canLogin}
                              onClick={() => updateDraft(pro.id, { vr: { ...draft.vr, prosAll: false } })}
                              className="flex-1 bg-slate-800 hover:bg-amber-500 hover:text-black disabled:opacity-40 text-[10px] px-2 py-1 rounded font-bold transition"
                            >ELEGIR…</button>
                          </div>
                        </div>
                      </div>

                      {/* Notes / vacaciones toggles */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                        <label className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer select-none transition ${draft.vr.showNotes ? "bg-amber-500/10 border-amber-500/40" : "bg-slate-900/60 border-slate-700"} ${!draft.canLogin ? "opacity-40 pointer-events-none" : ""}`}>
                          <input
                            type="checkbox"
                            checked={draft.vr.showNotes}
                            onChange={e => updateDraft(pro.id, { vr: { ...draft.vr, showNotes: e.target.checked } })}
                            className="h-4 w-4 accent-amber-500"
                          />
                          <div>
                            <div className="text-[11px] font-extrabold text-white">📝 Ver notas</div>
                            <div className="text-[9px] text-slate-400">Muestra los indicadores y el texto de las notas de las tarjetas</div>
                          </div>
                        </label>
                        <label className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer select-none transition ${draft.vr.showVacaciones ? "bg-amber-500/10 border-amber-500/40" : "bg-slate-900/60 border-slate-700"} ${!draft.canLogin ? "opacity-40 pointer-events-none" : ""}`}>
                          <input
                            type="checkbox"
                            checked={draft.vr.showVacaciones}
                            onChange={e => updateDraft(pro.id, { vr: { ...draft.vr, showVacaciones: e.target.checked } })}
                            className="h-4 w-4 accent-amber-500"
                          />
                          <div>
                            <div className="text-[11px] font-extrabold text-white">🏖️ Ver vacaciones/ausencias</div>
                            <div className="text-[9px] text-slate-400">Muestra las tarjetas de vacaciones, bajas y permisos en el mensual</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Permissions grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {PERM_GROUPS.map(group => (
                        <div key={group.title} className="bg-slate-800/60 border border-slate-700 rounded-lg p-3">
                          <h4 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider mb-2">
                            {group.title}
                          </h4>
                          <div className="space-y-2">
                            {group.perms.map(p => {
                              const checked = draft.perms[p.key];
                              const disabled = !draft.canLogin;
                              return (
                                <label
                                  key={p.key}
                                  className={`flex items-start gap-2 cursor-pointer select-none ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                                  title={p.help}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={disabled}
                                    onChange={e => togglePerm(pro.id, p.key, e.target.checked)}
                                    className="h-4 w-4 mt-0.5 accent-emerald-500"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-bold text-white">{p.label}</div>
                                    <div className="text-[10px] text-slate-400 leading-tight">{p.help}</div>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div className="text-[10px] text-slate-500">
                        {draft.dirty
                          ? <span className="text-amber-400 font-bold">● Cambios sin guardar</span>
                          : <span className="text-slate-600">Sin cambios</span>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setExpandedId(null)}
                          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition"
                        >
                          Cerrar
                        </button>
                        <button
                          onClick={() => save(pro.id)}
                          disabled={!draft.dirty || savingId === pro.id}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition flex items-center gap-2"
                        >
                          {savingId === pro.id && (
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          )}
                          {savingId === pro.id ? "Guardando..." : "Guardar"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer info */}
      {!loading && rows.length > 0 && (
        <div className="text-[11px] text-slate-500 px-1 pt-1">
          {rows.filter(r => (drafts[r.professional.id]?.canLogin)).length} de {rows.length} profesionales con acceso activo. Cada acceso entra con su propia contraseña desde el login principal.
        </div>
      )}

      <OpsPanel />
    </div>
  );
}

/** Sección de OPERACIONES: envíos de avisos por email + auditoría de cambios. */
function OpsPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"envios" | "auditoria">("envios");
  const [outbox, setOutbox] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const [oRes, aRes] = await Promise.all([
        fetch("/api/company/outbox"),
        fetch("/api/company/audit"),
      ]);
      if (oRes.ok) setOutbox(await oRes.json());
      if (aRes.ok) setAudit(await aRes.json());
    } catch { /* noop */ } finally { setBusy(false); }
  };

  useEffect(() => { if (open) load(); }, [open]);

  const retrySend = async () => {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/company/outbox", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      setMsg(res.ok ? `Enviados ${j.sent}/${j.attempted}` : (j.error || "Error"));
      await load();
    } catch { setMsg("Error de conexión"); } finally { setBusy(false); }
  };

  const statusBadge = (s: string) =>
    s === "sent" ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/40"
    : s === "failed" ? "bg-red-600/20 text-red-400 border-red-600/40"
    : "bg-amber-500/20 text-amber-400 border-amber-500/40";

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 text-left">
        <span className="text-2xl">📮</span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-white text-sm">Envíos de avisos y auditoría</span>
          <span className="block text-xs text-slate-400">Emails automáticos al crear avisos y registro de quién cambió qué.</span>
        </span>
        <span className="text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2 items-center flex-wrap">
            <button onClick={() => setTab("envios")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${tab === "envios" ? "bg-[#6BBE7A] text-black" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>📧 Envíos</button>
            <button onClick={() => setTab("auditoria")} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${tab === "auditoria" ? "bg-[#6BBE7A] text-black" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>🧾 Auditoría</button>
            <button onClick={load} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white transition">⟳</button>
            {tab === "envios" && (
              <button onClick={retrySend} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white transition" title="Reintentar envíos pendientes (requiere RESEND_API_KEY en el servidor)">
                ↗ Reintentar envío
              </button>
            )}
            {msg && <span className="text-xs text-amber-400 font-bold">{msg}</span>}
          </div>

          {tab === "envios" && (
            <div className="space-y-1 max-h-[360px] overflow-y-auto">
              {outbox.length === 0 && (
                <p className="text-xs text-slate-500 py-4 text-center">
                  Sin envíos todavía. Configura el email en MI EMPRESA → Logo y Branding → «Email para avisos automáticos».
                </p>
              )}
              {outbox.map(o => (
                <div key={o.id} className="flex items-start gap-2 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
                  <span className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${statusBadge(o.status)}`}>{o.status}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">{o.subject}</div>
                    <div className="text-[10px] text-slate-400 truncate">→ {o.target} · {new Date(o.createdAt).toLocaleString("es-ES")}{o.error ? ` · ⚠ ${o.error}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "auditoria" && (
            <div className="space-y-1 max-h-[360px] overflow-y-auto">
              {audit.length === 0 && (
                <p className="text-xs text-slate-500 py-4 text-center">Sin eventos registrados todavía.</p>
              )}
              {audit.map(e => (
                <div key={e.id} className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5">
                  <span className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                    e.action === "AVISO_CREATE" ? "bg-emerald-600/20 text-emerald-400"
                    : e.action === "AVISO_DELETE" ? "bg-red-600/20 text-red-400"
                    : "bg-slate-600/30 text-slate-300"
                  }`}>{e.action}</span>
                  <span className="text-xs text-slate-200 font-bold truncate flex-1">{e.detail}</span>
                  <span className="text-[10px] text-slate-500 shrink-0">{e.userName || "—"} · {new Date(e.createdAt).toLocaleString("es-ES")}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
