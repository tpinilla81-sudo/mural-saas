"use client";

import { useState, useEffect, useCallback } from "react";

type Sede = {
  id: string; name: string; city: string; province: string; task: string;
  email: string; phone: string; morningEnabled: boolean; afternoonEnabled: boolean; color: string;
};

export default function SedesTab() {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [form, setForm] = useState({
    name: "", city: "", province: "", task: "", email: "", phone: "",
    morningEnabled: true, afternoonEnabled: true, color: "#3b82f6"
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sede | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/company/sedes");
      if (res.ok) {
        setSedes(await res.json());
      } else {
        showToast("Error al cargar sedes", "error");
      }
    } catch {
      showToast("Error de conexión al cargar sedes", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast("El nombre de la sede es obligatorio", "error");
      return;
    }
    try {
      if (editingId) {
        const res = await fetch(`/api/company/sedes/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Error desconocido" }));
          showToast(data.error || "Error al actualizar sede", "error");
          return;
        }
        showToast("Sede actualizada correctamente");
      } else {
        const res = await fetch("/api/company/sedes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Error desconocido" }));
          showToast(data.error || "Error al crear sede", "error");
          return;
        }
        showToast("Sede creada correctamente");
      }
      setEditingId(null);
      setForm({ name: "", city: "", province: "", task: "", email: "", phone: "", morningEnabled: true, afternoonEnabled: true, color: "#3b82f6" });
      load();
    } catch {
      showToast("Error de conexión al guardar", "error");
    }
  };

  const handleEdit = (s: Sede) => {
    setEditingId(s.id);
    setForm({
      name: s.name, city: s.city, province: s.province, task: s.task,
      email: s.email, phone: s.phone,
      morningEnabled: s.morningEnabled, afternoonEnabled: s.afternoonEnabled, color: s.color
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ name: "", city: "", province: "", task: "", email: "", phone: "", morningEnabled: true, afternoonEnabled: true, color: "#3b82f6" });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/company/sedes/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast(`Sede "${deleteTarget.name}" eliminada`);
        setDeleteTarget(null);
        load();
      } else {
        const data = await res.json().catch(() => ({ error: "Error desconocido" }));
        showToast(data.error || "Error al eliminar la sede", "error");
      }
    } catch {
      showToast("Error de conexión al eliminar", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-bold transition-all animate-in fade-in slide-in-from-top-2 ${
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
              ¿Estás seguro de que quieres eliminar la sede <span className="text-amber-400 font-bold">&quot;{deleteTarget.name}&quot;</span>?
            </p>
            <p className="text-red-400 text-xs mb-5">
              Esta acción eliminará también todos los planes (calendarios) asociados a esta sede. No se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-bold transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition disabled:opacity-50 flex items-center gap-2"
              >
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
            {editingId ? "Editar Sede" : "Nueva Sede"}
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
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Sede</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Ciudad</label>
              <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Provincia</label>
              <input value={form.province} onChange={e => setForm({ ...form, province: e.target.value })}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Tarea</label>
              <input value={form.task} onChange={e => setForm({ ...form, task: e.target.value })}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Mail</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Tel.</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition" />
            </div>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">M</label>
              <select value={form.morningEnabled ? "SI" : "NO"} onChange={e => setForm({ ...form, morningEnabled: e.target.value === "SI" })}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs">
                <option>SI</option><option>NO</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">T</label>
              <select value={form.afternoonEnabled ? "SI" : "NO"} onChange={e => setForm({ ...form, afternoonEnabled: e.target.value === "SI" })}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs">
                <option>SI</option><option>NO</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Color</label>
              <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-10 h-8 rounded cursor-pointer" />
            </div>
            <button onClick={handleSave} className={`font-bold py-2 px-4 rounded text-xs transition ${
              editingId ? "bg-blue-500 hover:bg-blue-400 text-white" : "bg-amber-500 hover:bg-amber-400 text-black"
            }`}>
              {editingId ? "ACT." : "SAVE"}
            </button>
          </div>
        </div>
        {/* Desktop: wide grid */}
        <div className="hidden sm:grid gap-3 items-end" style={{ gridTemplateColumns: "repeat(9, 1fr) 100px" }}>
          {[
            { label: "Sede", key: "name" }, { label: "Ciudad", key: "city" }, { label: "Provincia", key: "province" },
            { label: "Tarea", key: "task" }, { label: "Mail", key: "email" }, { label: "Tel.", key: "phone" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">{f.label}</label>
              <input
                value={(form as any)[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">M</label>
            <select
              value={form.morningEnabled ? "SI" : "NO"}
              onChange={e => setForm({ ...form, morningEnabled: e.target.value === "SI" })}
              className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition"
            >
              <option>SI</option><option>NO</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">T</label>
            <select
              value={form.afternoonEnabled ? "SI" : "NO"}
              onChange={e => setForm({ ...form, afternoonEnabled: e.target.value === "SI" })}
              className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs focus:outline-none focus:border-amber-500 transition"
            >
              <option>SI</option><option>NO</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Color</label>
            <div className="flex gap-1 items-center">
              <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-10 h-8 rounded cursor-pointer" />
              <button
                onClick={handleSave}
                className={`font-bold py-2 px-3 rounded text-xs transition flex-1 ${
                  editingId
                    ? "bg-blue-500 hover:bg-blue-400 text-white"
                    : "bg-amber-500 hover:bg-amber-400 text-black"
                }`}
              >
                {editingId ? "ACT." : "SAVE"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: card layout */}
      <div className="sm:hidden space-y-2">
        {loading && sedes.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Cargando sedes...</div>
        ) : sedes.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-500 text-sm">No hay sedes registradas</div>
        ) : (
          sedes.map(s => (
            <div key={s.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ background: s.color }} />
                  <div>
                    <div className="text-sm font-bold text-white">{s.name}</div>
                    <div className="text-xs text-slate-400">{s.city}{s.province ? `, ${s.province}` : ""}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <span className={`text-[10px] font-bold ${s.morningEnabled ? "text-emerald-400" : "text-slate-500"}`}>M{s.morningEnabled ? "✓" : "✗"}</span>
                  <span className={`text-[10px] font-bold ${s.afternoonEnabled ? "text-emerald-400" : "text-slate-500"}`}>T{s.afternoonEnabled ? "✓" : "✗"}</span>
                </div>
              </div>
              {s.task && <div className="text-xs text-slate-400">Tarea: {s.task}</div>}
              {(s.phone || s.email) && <div className="text-xs text-slate-400">{s.phone || s.email}</div>}
              <div className="flex gap-2">
                <button onClick={() => handleEdit(s)} className="flex-1 bg-blue-600/20 text-blue-400 font-bold py-1.5 rounded text-xs">EDITAR</button>
                <button onClick={() => setDeleteTarget(s)} className="bg-red-600/20 text-red-400 font-bold py-1.5 px-3 rounded text-xs">✕</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block bg-slate-800/50 border border-slate-700 rounded-xl overflow-auto max-h-[calc(100vh-320px)]">
        {loading && sedes.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-400 text-sm">Cargando sedes...</div>
        ) : sedes.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-500 text-sm">No hay sedes registradas</div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-900 border-b border-slate-700">
                {["Sede", "Ubicación", "Tarea", "Contacto", "M/T", "Color", "Acciones"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sedes.map(s => (
                <tr key={s.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                  <td className="px-4 py-2 text-sm font-bold">{s.name}</td>
                  <td className="px-4 py-2 text-xs">{s.city}{s.province ? `, ${s.province}` : ""}</td>
                  <td className="px-4 py-2 text-xs">{s.task}</td>
                  <td className="px-4 py-2 text-xs">{s.phone || s.email || "—"}</td>
                  <td className="px-4 py-2 text-xs">
                    <span className={s.morningEnabled ? "text-emerald-400" : "text-slate-500"}>{s.morningEnabled ? "S" : "N"}</span>
                    /
                    <span className={s.afternoonEnabled ? "text-emerald-400" : "text-slate-500"}>{s.afternoonEnabled ? "S" : "N"}</span>
                  </td>
                  <td className="px-4 py-2"><div className="w-5 h-5 rounded border border-slate-600" style={{ background: s.color }} /></td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(s)} className="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-xs transition" title="Editar sede">✏️</button>
                      <button onClick={() => setDeleteTarget(s)} className="bg-red-600/30 hover:bg-red-600/50 text-red-400 px-2 py-1 rounded text-xs transition" title="Eliminar sede">✖</button>
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
