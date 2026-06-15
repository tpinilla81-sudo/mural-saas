"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

type Professional = {
  id: string; firstName: string; lastName: string; alias: string;
  type: string; category: string; email: string; phone: string;
  permissions: string; assignedSedes: string; endDate: string;
};

export default function ProfesionalTab() {
  const { data: session } = useSession();
  const [pros, setPros] = useState<Professional[]>([]);
  const [sedes, setSedes] = useState<any[]>([]);
  const [form, setForm] = useState({
    firstName: "", lastName: "", alias: "", type: "USER", category: "",
    email: "", phone: "", permissions: "", assignedSedes: "", endDate: "INDEFINIDO"
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Professional | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([fetch("/api/company/professionals"), fetch("/api/company/sedes")]);
      if (pRes.ok) setPros(await pRes.json());
      else showToast("Error al cargar profesionales", "error");
      if (sRes.ok) setSedes(await sRes.json());
    } catch {
      showToast("Error de conexión al cargar datos", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const handleAutoAlias = () => {
    if (form.firstName && form.lastName) {
      setForm(f => ({ ...f, alias: (form.firstName[0] + form.lastName.split(" ")[0][0]).toUpperCase() }));
    }
  };

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      showToast("Nombre y apellidos son obligatorios", "error");
      return;
    }
    try {
      if (editingId) {
        const res = await fetch(`/api/company/professionals/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Error desconocido" }));
          showToast(data.error || "Error al actualizar profesional", "error");
          return;
        }
        showToast("Profesional actualizado correctamente");
      } else {
        const res = await fetch("/api/company/professionals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Error desconocido" }));
          showToast(data.error || "Error al crear profesional", "error");
          return;
        }
        showToast("Profesional creado correctamente");
      }
      setEditingId(null);
      setForm({ firstName: "", lastName: "", alias: "", type: "USER", category: "", email: "", phone: "", permissions: "", assignedSedes: "", endDate: "INDEFINIDO" });
      load();
    } catch {
      showToast("Error de conexión al guardar", "error");
    }
  };

  const handleEdit = (p: Professional) => {
    setEditingId(p.id);
    setForm({
      firstName: p.firstName, lastName: p.lastName, alias: p.alias, type: p.type,
      category: p.category, email: p.email, phone: p.phone,
      permissions: p.permissions, assignedSedes: p.assignedSedes, endDate: p.endDate
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ firstName: "", lastName: "", alias: "", type: "USER", category: "", email: "", phone: "", permissions: "", assignedSedes: "", endDate: "INDEFINIDO" });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/company/professionals/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast(`Profesional "${deleteTarget.firstName} ${deleteTarget.lastName}" eliminado`);
        setDeleteTarget(null);
        load();
      } else {
        const data = await res.json().catch(() => ({ error: "Error desconocido" }));
        showToast(data.error || "Error al eliminar el profesional", "error");
      }
    } catch {
      showToast("Error de conexión al eliminar", "error");
    } finally {
      setDeleting(false);
    }
  };

  const sedeNames = [...new Set(sedes.map(s => s.name))].sort();
  const taskNames = [...new Set(sedes.map(s => s.task))].sort();

  return (
    <div className="space-y-5">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-bold transition-all ${
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Confirmar eliminación</h3>
            <p className="text-slate-300 text-sm mb-1">
              ¿Estás seguro de que quieres eliminar al profesional{" "}
              <span className="text-amber-400 font-bold">&quot;{deleteTarget.firstName} {deleteTarget.lastName}&quot;</span>?
            </p>
            <p className="text-red-400 text-xs mb-5">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={confirmDelete} disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition disabled:opacity-50 flex items-center gap-2">
                {deleting && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-5">
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-extrabold text-blue-400 uppercase tracking-wider">
            {editingId ? "Editar Profesional" : "Nuevo Profesional"}
          </h2>
          {editingId && (
            <button onClick={handleCancelEdit} className="text-xs text-slate-400 hover:text-white transition">
              Cancelar edición
            </button>
          )}
        </div>
        {/* Mobile: stacked layout */}
        <div className="sm:hidden space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Nombre</label>
              <input value={form.firstName} onChange={e => { setForm({ ...form, firstName: e.target.value }); handleAutoAlias(); }}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Apellidos</label>
              <input value={form.lastName} onChange={e => { setForm({ ...form, lastName: e.target.value }); handleAutoAlias(); }}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Alias</label>
              <input value={form.alias} readOnly className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs opacity-70" />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Tipo</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs">
                <option value="USER">USUARIO</option>
                <option value="ADMINISTRADOR">ADMIN</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Cat.</label>
              <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Sedes</label>
            <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-600 rounded p-2 min-h-[34px]">
              {sedeNames.map(s => (
                <button key={s} onClick={() => {
                  const current = form.assignedSedes ? form.assignedSedes.split(", ") : [];
                  const next = current.includes(s) ? current.filter(x => x !== s) : [...current, s];
                  setForm({ ...form, assignedSedes: next.join(", ") });
                }} className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition ${form.assignedSedes?.split(", ").includes(s) ? "bg-amber-500 text-black" : "bg-slate-700 text-slate-400"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Tareas Aut.</label>
            <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-600 rounded p-2 min-h-[34px]">
              {taskNames.map(t => (
                <button key={t} onClick={() => {
                  const current = form.permissions ? form.permissions.split(", ") : [];
                  const next = current.includes(t) ? current.filter(x => x !== t) : [...current, t];
                  setForm({ ...form, permissions: next.join(", ") });
                }} className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition ${form.permissions?.split(", ").includes(t) ? "bg-blue-500 text-white" : "bg-slate-700 text-slate-400"}`}>
                  {t.substring(0, 6)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Email</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" placeholder="email" />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Tel.</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" placeholder="tel" />
            </div>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Fin</label>
              <input value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" />
            </div>
            <button onClick={handleSave} className={`font-bold py-2 px-4 rounded text-xs transition ${
              editingId ? "bg-blue-500 hover:bg-blue-400 text-white" : "bg-amber-500 hover:bg-amber-400 text-black"
            }`}>
              {editingId ? "ACT." : "GUARDAR"}
            </button>
          </div>
        </div>
        {/* Desktop: wide grid */}
        <div className="hidden sm:grid gap-3 items-end" style={{ gridTemplateColumns: "1fr 1fr 0.5fr 1.5fr 0.8fr 1fr 0.8fr 1.8fr 0.8fr 100px" }}>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Nombre</label>
            <input value={form.firstName} onChange={e => { setForm({ ...form, firstName: e.target.value }); handleAutoAlias(); }} className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Apellidos</label>
            <input value={form.lastName} onChange={e => { setForm({ ...form, lastName: e.target.value }); handleAutoAlias(); }} className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Alias</label>
            <input value={form.alias} readOnly className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs opacity-70" />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Sedes</label>
            <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-600 rounded p-1 min-h-[34px]">
              {sedeNames.map(s => (
                <button key={s} onClick={() => {
                  const current = form.assignedSedes ? form.assignedSedes.split(", ") : [];
                  const next = current.includes(s) ? current.filter(x => x !== s) : [...current, s];
                  setForm({ ...form, assignedSedes: next.join(", ") });
                }} className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition ${form.assignedSedes?.split(", ").includes(s) ? "bg-amber-500 text-black" : "bg-slate-700 text-slate-400"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Tipo</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition">
              <option value="USER">USUARIO</option>
              <option value="ADMINISTRADOR">ADMIN</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Cat.</label>
            <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Tareas Aut.</label>
            <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-600 rounded p-1 min-h-[34px]">
              {taskNames.map(t => (
                <button key={t} onClick={() => {
                  const current = form.permissions ? form.permissions.split(", ") : [];
                  const next = current.includes(t) ? current.filter(x => x !== t) : [...current, t];
                  setForm({ ...form, permissions: next.join(", ") });
                }} className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition ${form.permissions?.split(", ").includes(t) ? "bg-blue-500 text-white" : "bg-slate-700 text-slate-400"}`}>
                  {t.substring(0, 6)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Mail / Tel.</label>
            <div className="flex gap-1">
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="flex-1 px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" placeholder="email" />
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-20 px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" placeholder="tel" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Fin</label>
            <input value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" />
          </div>
          <button onClick={handleSave} className={`font-bold py-2 px-3 rounded text-xs transition h-[34px] ${
            editingId ? "bg-blue-500 hover:bg-blue-400 text-white" : "bg-amber-500 hover:bg-amber-400 text-black"
          }`}>
            {editingId ? "ACTUALIZAR" : "GUARDAR"}
          </button>
        </div>
      </div>

      {/* Mobile: card layout */}
      <div className="sm:hidden space-y-2">
        {loading && pros.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Cargando profesionales...</div>
        ) : pros.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-500 text-sm">No hay profesionales registrados</div>
        ) : (
          pros.map(p => (
            <div key={p.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm font-bold text-white">{p.firstName} {p.lastName}</div>
                  <div className="text-xs text-slate-400">Alias: {p.alias} · {p.type}</div>
                </div>
                {p.category && <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded font-bold text-slate-300">{p.category}</span>}
              </div>
              {(p.assignedSedes || "").split(", ").filter(Boolean).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(p.assignedSedes || "").split(", ").filter(Boolean).map(s =>
                    <span key={s} className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">{s}</span>
                  )}
                </div>
              )}
              {(p.permissions || "").split(", ").filter(Boolean).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(p.permissions || "").split(", ").filter(Boolean).map(t =>
                    <span key={t} className="text-[9px] bg-blue-600/40 px-1.5 py-0.5 rounded font-bold">{t.substring(0, 3)}</span>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center">
                <div className="text-xs text-slate-400">
                  {p.phone && <span>{p.phone}</span>}
                  {p.endDate && p.endDate !== "INDEFINIDO" && <span> · Fin: {p.endDate}</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(p)} className="bg-blue-600/20 text-blue-400 font-bold py-1.5 px-3 rounded text-xs">EDITAR</button>
                  <button onClick={() => setDeleteTarget(p)} className="bg-red-600/20 text-red-400 font-bold py-1.5 px-3 rounded text-xs">✕</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block bg-slate-800/50 border border-slate-700 rounded-xl overflow-auto max-h-[calc(100vh-320px)]">
        {loading && pros.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Cargando profesionales...</div>
        ) : pros.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-500 text-sm">No hay profesionales registrados</div>
        ) : (
          <table className="w-full min-w-[1200px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-900 border-b border-slate-700">
                {["Profesional", "Alias", "Sedes", "Tipo/Cat", "Contacto", "Tareas", "Vigencia", "Acciones"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pros.map(p => (
                <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                  <td className="px-4 py-2 text-sm font-bold">{p.firstName} {p.lastName}</td>
                  <td className="px-4 py-2 text-sm">{p.alias}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(p.assignedSedes || "").split(", ").filter(Boolean).map(s =>
                        <span key={s} className="text-[8px] bg-slate-700 px-1.5 py-0.5 rounded font-bold">{s.substring(0, 3)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs">{p.type} / {p.category}</td>
                  <td className="px-4 py-2 text-xs">{p.phone}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(p.permissions || "").split(", ").filter(Boolean).map(t =>
                        <span key={t} className="text-[8px] bg-blue-600/40 px-1.5 py-0.5 rounded font-bold">{t.substring(0, 3)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs">{p.endDate}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(p)} className="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-xs transition" title="Editar profesional">✏️</button>
                      <button onClick={() => setDeleteTarget(p)} className="bg-red-600/30 hover:bg-red-600/50 text-red-400 px-2 py-1 rounded text-xs transition" title="Eliminar profesional">✖</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
