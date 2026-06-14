"use client";

import { useState, useEffect } from "react";

type Sede = { id: string; name: string; city: string; province: string; task: string; email: string; phone: string; morningEnabled: boolean; afternoonEnabled: boolean; color: string; };

export default function SedesTab() {
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [form, setForm] = useState({ name: "", city: "", province: "", task: "", email: "", phone: "", morningEnabled: true, afternoonEnabled: true, color: "#3b82f6" });
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/company/sedes");
    if (res.ok) setSedes(await res.json());
  }

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (editingId) {
      await fetch(`/api/company/sedes/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    } else {
      await fetch("/api/company/sedes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setEditingId(null);
    setForm({ name: "", city: "", province: "", task: "", email: "", phone: "", morningEnabled: true, afternoonEnabled: true, color: "#3b82f6" });
    load();
  };

  const handleEdit = (s: Sede) => {
    setEditingId(s.id);
    setForm({ name: s.name, city: s.city, province: s.province, task: s.task, email: s.email, phone: s.phone, morningEnabled: s.morningEnabled, afternoonEnabled: s.afternoonEnabled, color: s.color });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta sede?")) return;
    await fetch(`/api/company/sedes/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-5">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <div className="grid gap-3 items-end" style={{ gridTemplateColumns: "repeat(9, 1fr) 100px" }}>
          {[
            { label: "Sede", key: "name" }, { label: "Ciudad", key: "city" }, { label: "Provincia", key: "province" },
            { label: "Tarea", key: "task" }, { label: "Mail", key: "email" }, { label: "Tel.", key: "phone" },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">{f.label}</label>
              <input value={(form as any)[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})} className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">M</label>
            <select value={form.morningEnabled ? "SI" : "NO"} onChange={e => setForm({...form, morningEnabled: e.target.value === "SI"})} className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs">
              <option>SI</option><option>NO</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">T</label>
            <select value={form.afternoonEnabled ? "SI" : "NO"} onChange={e => setForm({...form, afternoonEnabled: e.target.value === "SI"})} className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs">
              <option>SI</option><option>NO</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Color</label>
            <div className="flex gap-1 items-center">
              <input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="w-10 h-8 rounded cursor-pointer" />
              <button onClick={handleSave} className="bg-amber-500 hover:bg-amber-400 text-black font-bold py-2 px-3 rounded text-xs transition flex-1">
                {editingId ? "ACT." : "SAVE"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-auto max-h-[calc(100vh-320px)]">
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
              <tr key={s.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-4 py-2 text-sm font-bold">{s.name}</td>
                <td className="px-4 py-2 text-xs">{s.city}</td>
                <td className="px-4 py-2 text-xs">{s.task}</td>
                <td className="px-4 py-2 text-xs">{s.phone}</td>
                <td className="px-4 py-2 text-xs">{s.morningEnabled ? "S" : "N"}/{s.afternoonEnabled ? "S" : "N"}</td>
                <td className="px-4 py-2"><div className="w-5 h-5 rounded" style={{ background: s.color }} /></td>
                <td className="px-4 py-2 flex gap-1">
                  <button onClick={() => handleEdit(s)} className="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-xs">✏️</button>
                  <button onClick={() => handleDelete(s.id)} className="bg-red-600/30 hover:bg-red-600/50 text-red-400 px-2 py-1 rounded text-xs">✖</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
