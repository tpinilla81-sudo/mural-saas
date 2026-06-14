"use client";

import { useState, useEffect } from "react";
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
  const [form, setForm] = useState({ firstName: "", lastName: "", alias: "", type: "USER", category: "", email: "", phone: "", permissions: "", assignedSedes: "", endDate: "INDEFINIDO" });
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    const [pRes, sRes] = await Promise.all([fetch("/api/company/professionals"), fetch("/api/company/sedes")]);
    if (pRes.ok) setPros(await pRes.json());
    if (sRes.ok) setSedes(await sRes.json());
  }

  useEffect(() => { load(); }, []);

  const handleAutoAlias = () => {
    if (form.firstName && form.lastName) {
      setForm(f => ({ ...f, alias: (form.firstName[0] + form.lastName.split(" ")[0][0]).toUpperCase() }));
    }
  };

  const handleSave = async () => {
    if (editingId) {
      await fetch(`/api/company/professionals/${editingId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    } else {
      await fetch("/api/company/professionals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    }
    setEditingId(null);
    setForm({ firstName: "", lastName: "", alias: "", type: "USER", category: "", email: "", phone: "", permissions: "", assignedSedes: "", endDate: "INDEFINIDO" });
    load();
  };

  const handleEdit = (p: Professional) => {
    setEditingId(p.id);
    setForm({ firstName: p.firstName, lastName: p.lastName, alias: p.alias, type: p.type, category: p.category, email: p.email, phone: p.phone, permissions: p.permissions, assignedSedes: p.assignedSedes, endDate: p.endDate });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este profesional?")) return;
    await fetch(`/api/company/professionals/${id}`, { method: "DELETE" });
    load();
  };

  const sedeNames = [...new Set(sedes.map(s => s.name))].sort();
  const taskNames = [...new Set(sedes.map(s => s.task))].sort();

  return (
    <div className="space-y-5">
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <div className="grid gap-3 items-end" style={{ gridTemplateColumns: "1fr 1fr 0.5fr 1.5fr 0.8fr 1fr 0.8fr 1.8fr 0.8fr 100px" }}>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Nombre</label>
            <input value={form.firstName} onChange={e => { setForm({...form, firstName: e.target.value}); handleAutoAlias(); }} className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs" />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Apellidos</label>
            <input value={form.lastName} onChange={e => { setForm({...form, lastName: e.target.value}); handleAutoAlias(); }} className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs" />
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
                  setForm({...form, assignedSedes: next.join(", ")});
                }} className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition ${form.assignedSedes?.split(", ").includes(s) ? "bg-amber-500 text-black" : "bg-slate-700 text-slate-400"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Tipo</label>
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs">
              <option value="USER">USUARIO</option>
              <option value="ADMINISTRADOR">ADMIN</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Cat.</label>
            <input value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs" />
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Tareas Aut.</label>
            <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-600 rounded p-1 min-h-[34px]">
              {taskNames.map(t => (
                <button key={t} onClick={() => {
                  const current = form.permissions ? form.permissions.split(", ") : [];
                  const next = current.includes(t) ? current.filter(x => x !== t) : [...current, t];
                  setForm({...form, permissions: next.join(", ")});
                }} className={`text-[9px] px-1.5 py-0.5 rounded font-bold transition ${form.permissions?.split(", ").includes(t) ? "bg-blue-500 text-white" : "bg-slate-700 text-slate-400"}`}>
                  {t.substring(0, 6)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Mail / Tel.</label>
            <div className="flex gap-1">
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="flex-1 px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs" placeholder="email" />
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-20 px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs" placeholder="tel" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Fin</label>
            <input value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className="w-full px-2 py-2 bg-slate-900 border border-slate-600 rounded text-white text-xs" />
          </div>
          <button onClick={handleSave} className="bg-amber-500 hover:bg-amber-400 text-black font-bold py-2 px-3 rounded text-xs transition h-[34px]">
            {editingId ? "ACTUALIZAR" : "GUARDAR"}
          </button>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-auto max-h-[calc(100vh-320px)]">
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
              <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-4 py-2 text-sm font-bold">{p.firstName} {p.lastName}</td>
                <td className="px-4 py-2 text-sm">{p.alias}</td>
                <td className="px-4 py-2"><div className="flex flex-wrap gap-1">{(p.assignedSedes || "").split(", ").filter(Boolean).map(s => <span key={s} className="text-[8px] bg-slate-700 px-1.5 py-0.5 rounded font-bold">{s.substring(0,3)}</span>)}</div></td>
                <td className="px-4 py-2 text-xs">{p.type} / {p.category}</td>
                <td className="px-4 py-2 text-xs">{p.phone}</td>
                <td className="px-4 py-2"><div className="flex flex-wrap gap-1">{(p.permissions || "").split(", ").filter(Boolean).map(t => <span key={t} className="text-[8px] bg-blue-600/40 px-1.5 py-0.5 rounded font-bold">{t.substring(0,3)}</span>)}</div></td>
                <td className="px-4 py-2 text-xs">{p.endDate}</td>
                <td className="px-4 py-2 flex gap-1">
                  <button onClick={() => handleEdit(p)} className="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-xs">✏️</button>
                  <button onClick={() => handleDelete(p.id)} className="bg-red-600/30 hover:bg-red-600/50 text-red-400 px-2 py-1 rounded text-xs">✖</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
