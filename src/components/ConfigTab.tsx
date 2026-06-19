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
  | "can_print" | "can_send";

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
    ],
  },
];

const ALL_PERM_KEYS: PermKey[] = PERM_GROUPS.flatMap(g => g.perms.map(p => p.key));

function emptyPerms(): Perms {
  const o = {} as Perms;
  for (const k of ALL_PERM_KEYS) o[k] = false;
  return o;
}

type Row = {
  professional: {
    id: string; firstName: string; lastName: string; alias: string;
    email: string; phone: string; assignedSedes: string;
  };
  user: {
    id: string; email: string; name: string;
    isActive: boolean; hasPin: boolean;
    permissions: Perms;
  } | null;
  canLogin: boolean;
};

export default function ConfigTab() {
  const { data: session } = useSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Local draft state: keyed by professionalId → { email, canLogin, pin, pinCleared, perms }
  const [drafts, setDrafts] = useState<Record<string, {
    email: string; canLogin: boolean;
    pin: string; pinCleared: boolean;
    perms: Perms; dirty: boolean;
  }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/company/permissions");
      if (!r.ok) { showToast("Error al cargar permisos", "error"); return; }
      const data: Row[] = await r.json();
      setRows(data);
      const next: Record<string, { email: string; canLogin: boolean; pin: string; pinCleared: boolean; perms: Perms; dirty: boolean }> = {};
      for (const row of data) {
        next[row.professional.id] = {
          email: row.user?.email || row.professional.email || "",
          canLogin: !!row.canLogin,
          pin: "",
          pinCleared: false,
          perms: row.user?.permissions || emptyPerms(),
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

  const updateDraft = (proId: string, patch: Partial<{ email: string; canLogin: boolean; pin: string; pinCleared: boolean }>) => {
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
      // If login is being disabled, keep perms but they won't be active
      return { ...prev, [proId]: { ...d, perms, dirty: true } };
    });
  };

  const save = async (proId: string) => {
    const draft = drafts[proId];
    if (!draft) return;
    if (draft.canLogin && !draft.email.includes("@")) {
      showToast("Email inválido", "error");
      return;
    }
    // PIN validation: if a new PIN was typed it must be 4 digits
    if (draft.pin && !/^\d{4}$/.test(draft.pin)) {
      showToast("El PIN debe ser 4 dígitos", "error");
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
      };
      // Send PIN: a new pin if typed, null if explicitly cleared, undefined otherwise (leave unchanged)
      if (draft.pin) {
        body.pin = draft.pin;
      } else if (draft.pinCleared) {
        body.pin = null;
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
      showToast("Permisos guardados correctamente");
      // Clear dirty flag + reset PIN draft fields and reload server state
      setDrafts(prev => ({
        ...prev,
        [proId]: { ...prev[proId], pin: "", pinCleared: false, dirty: false },
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
              Gestiona qué profesionales pueden iniciar sesión (selector libre, sin contraseña) y los permisos granulares de cada uno.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] sm:text-xs">
          {PERM_GROUPS.map(g => (
            <span key={g.title} className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-slate-300 font-bold uppercase tracking-wider">
              {g.title}: {g.perms.length}
            </span>
          ))}
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
            const draft = drafts[pro.id] || { email: "", password: "", canLogin: false, perms: emptyPerms(), dirty: false };
            const expanded = expandedId === pro.id;
            const activePerms = ALL_PERM_KEYS.filter(k => draft.perms[k]).length;

            return (
              <div key={pro.id} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                {/* Collapsed row */}
                <div
                  className="flex items-center gap-3 p-3 sm:p-4 cursor-pointer hover:bg-slate-700/30 transition"
                  onClick={() => setExpandedId(expanded ? null : pro.id)}
                >
                  {/* Avatar */}
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
                      {row.user?.hasPin && <span className="text-blue-400 ml-2">· PIN activo</span>}
                      {activePerms > 0 && <span className="ml-2">· {activePerms} permiso(s)</span>}
                    </div>
                  </div>

                  <div className="text-slate-400 text-xs shrink-0">
                    {expanded ? "▲" : "▼"}
                  </div>
                </div>

                {/* Expanded panel */}
                {expanded && (
                  <div className="border-t border-slate-700 p-3 sm:p-5 space-y-4 bg-slate-900/40">
                    {/* Login enable + email */}
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
                          Si está activado, este profesional aparece en el selector del login (sin contraseña) y puede entrar directamente con sus permisos.
                        </p>
                      </div>

                      <div className="sm:col-span-8">
                        <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Email (identificador de login)</label>
                        <input
                          type="email"
                          value={draft.email}
                          onChange={e => updateDraft(pro.id, { email: e.target.value })}
                          disabled={!draft.canLogin}
                          placeholder="profesional@clinica.com"
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>

                    {/* PIN (optional 4-digit) */}
                    <div className="grid sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-4">
                        <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">PIN de acceso (opcional)</label>
                        <p className="text-[10px] text-slate-500 mt-1 leading-tight">
                          Si lo configuras, se pedirá este PIN de 4 dígitos al iniciar sesión. Si lo dejas vacío, el acceso es libre.
                        </p>
                      </div>
                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="\d{4}"
                          maxLength={4}
                          value={draft.pin}
                          onChange={e => updateDraft(pro.id, { pin: e.target.value.replace(/\D/g, "").slice(0, 4), pinCleared: false })}
                          disabled={!draft.canLogin}
                          placeholder={row.user?.hasPin ? "•••• (escribir nuevo para cambiar)" : "4 dígitos numéricos"}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm tracking-[0.5em] font-mono focus:outline-none focus:border-amber-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                        {row.user?.hasPin && !draft.pin && !draft.pinCleared && (
                          <div className="text-[10px] text-blue-400 mt-1 font-bold">PIN activo configurado</div>
                        )}
                        {draft.pin && (
                          <div className="text-[10px] text-amber-400 mt-1 font-bold">Se establecerá este PIN al guardar</div>
                        )}
                      </div>
                      <div className="sm:col-span-3 flex items-end">
                        {row.user?.hasPin && (
                          <button
                            type="button"
                            onClick={() => updateDraft(pro.id, { pin: "", pinCleared: true })}
                            disabled={!draft.canLogin}
                            className={`w-full px-3 py-2 rounded text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                              draft.pinCleared ? "bg-red-600 text-white" : "bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/30"
                            }`}
                          >
                            {draft.pinCleared ? "Se quitará al guardar" : "Quitar PIN"}
                          </button>
                        )}
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
          {rows.filter(r => (drafts[r.professional.id]?.canLogin)).length} de {rows.length} profesionales con acceso activo.
        </div>
      )}
    </div>
  );
}
