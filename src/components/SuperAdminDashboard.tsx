"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

type Company = any;

export default function SuperAdminDashboard() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<"companies" | "users">("companies");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyUsers, setCompanyUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [toasts, setToasts] = useState<{ id: number; message: string; type: "success" | "error" }[]>([]);

  const [form, setForm] = useState({
    name: "", slug: "", planName: "BASIC", billingMethod: "MONTHLY", price: 29.99,
    address: "", city: "", province: "", postalCode: "", nif: "", phone: "", email: "", logoUrl: "",
  });
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "COMPANY_ADMIN" });

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  async function fetchCompanies() {
    const res = await fetch("/api/admin/companies");
    if (res.ok) setCompanies(await res.json());
    setLoading(false);
  }

  async function fetchCompanyUsers(companyId: string) {
    const res = await fetch(`/api/admin/companies/${companyId}/users`);
    if (res.ok) setCompanyUsers(await res.json());
  }

  useEffect(() => { fetchCompanies(); }, []);

  const handleSaveCompany = async () => {
    if (!form.name || !form.slug) { addToast("Nombre y slug requeridos", "error"); return; }
    if (editCompany) {
      await fetch(`/api/admin/companies/${editCompany.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      await fetch(`/api/admin/companies/${editCompany.id}/subscription`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName: form.planName, billingMethod: form.billingMethod, price: form.price }),
      });
      addToast("Empresa actualizada");
    } else {
      await fetch("/api/admin/companies", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      addToast("Empresa creada");
    }
    setShowCompanyModal(false); setEditCompany(null); fetchCompanies();
  };

  const handleToggleActive = async (company: Company) => {
    await fetch(`/api/admin/companies/${company.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...company, isActive: !company.isActive }),
    });
    fetchCompanies();
  };

  const openEditCompany = (c: Company) => {
    setEditCompany(c);
    setForm({
      name: c.name, slug: c.slug, planName: c.subscription?.planName || "BASIC",
      billingMethod: c.subscription?.billingMethod || "MONTHLY", price: c.subscription?.price || 29.99,
      address: c.address || "", city: c.city || "", province: c.province || "",
      postalCode: c.postalCode || "", nif: c.nif || "", phone: c.phone || "",
      email: c.email || "", logoUrl: c.logoUrl || "",
    });
    setShowCompanyModal(true);
  };

  const openNewCompany = () => {
    setEditCompany(null);
    setForm({ name: "", slug: "", planName: "BASIC", billingMethod: "MONTHLY", price: 29.99, address: "", city: "", province: "", postalCode: "", nif: "", phone: "", email: "", logoUrl: "" });
    setShowCompanyModal(true);
  };

  const handleCreateUser = async () => {
    if (!userForm.name || !userForm.email || !userForm.password || !selectedCompanyId) {
      addToast("Todos los campos son obligatorios", "error"); return;
    }
    const res = await fetch("/api/auth/register", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...userForm, companyId: selectedCompanyId }),
    });
    if (res.ok) {
      addToast("Usuario creado");
      setShowUserModal(false);
      setUserForm({ name: "", email: "", password: "", role: "COMPANY_ADMIN" });
      fetchCompanyUsers(selectedCompanyId);
    } else {
      const data = await res.json().catch(() => ({}));
      addToast(data.error || "Error creando usuario", "error");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("¿Eliminar este usuario?")) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) { addToast("Usuario eliminado"); if (selectedCompanyId) fetchCompanyUsers(selectedCompanyId); }
    else addToast("Error", "error");
  };

  const planLabels: Record<string, string> = { BASIC: "Básico", PRO: "Pro", ENTERPRISE: "Empresa" };
  const planColors: Record<string, string> = { BASIC: "bg-slate-600", PRO: "bg-blue-600", ENTERPRISE: "bg-[#2E5D3A]" };

  return (
    <div className="h-full flex flex-col p-3 sm:p-6 overflow-hidden">
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 shrink-0">
        {[
          { key: "companies" as const, label: "EMPRESAS" },
          { key: "users" as const, label: "USUARIOS" },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition whitespace-nowrap ${
              tab === t.key ? "bg-[#2E5D3A] text-white" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* ═══════ EMPRESAS ═══════ */}
        {tab === "companies" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg sm:text-xl font-bold text-white">Empresas</h2>
              <button onClick={openNewCompany} className="bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white font-bold px-3 py-2 rounded-lg text-xs sm:text-sm transition">
                + Nueva
              </button>
            </div>

            {/* Mobile: card layout */}
            <div className="sm:hidden space-y-2">
              {companies.map((c: any) => (
                <div key={c.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {c.logoUrl ? (
                        <img src={c.logoUrl} alt="" className="h-8 w-8 rounded object-contain" />
                      ) : (
                        <div className="h-8 w-8 rounded bg-[#2E5D3A] flex items-center justify-center text-white font-black text-xs">{c.name.charAt(0)}</div>
                      )}
                      <div>
                        <div className="text-sm font-bold text-white">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.slug}</div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${planColors[c.subscription?.planName] || "bg-slate-600"}`}>
                      {planLabels[c.subscription?.planName] || "Básico"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className={c.isActive ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                      {c.isActive ? "Activa" : "Inactiva"}
                    </span>
                    <span className="text-amber-400 font-bold">{c.subscription?.price?.toFixed(2)}€</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEditCompany(c)} className="flex-1 bg-blue-600/20 text-blue-400 font-bold py-1.5 rounded text-xs">EDITAR</button>
                    <button onClick={() => handleToggleActive(c)} className={`flex-1 font-bold py-1.5 rounded text-xs ${c.isActive ? "bg-red-600/20 text-red-400" : "bg-green-600/20 text-green-400"}`}>
                      {c.isActive ? "DESACTIVAR" : "ACTIVAR"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-700">
                      <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Empresa</th>
                      <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Plan</th>
                      <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Estado</th>
                      <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Users</th>
                      <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Sedes</th>
                      <th className="text-right px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Precio</th>
                      <th className="text-center px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map((c: any) => (
                      <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {c.logoUrl ? <img src={c.logoUrl} alt="" className="h-7 w-7 rounded object-contain" /> : <div className="h-7 w-7 rounded bg-[#2E5D3A] flex items-center justify-center text-white font-black text-xs">{c.name.charAt(0)}</div>}
                            <div><div className="text-sm font-bold text-white">{c.name}</div><div className="text-xs text-slate-500">{c.slug}</div></div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-1 rounded text-white ${planColors[c.subscription?.planName] || "bg-slate-600"}`}>{planLabels[c.subscription?.planName] || "Básico"}</span></td>
                        <td className="px-4 py-3"><span className={`text-xs font-bold ${c.isActive ? "text-green-400" : "text-red-400"}`}>{c.isActive ? "Activa" : "Inactiva"}</span></td>
                        <td className="px-4 py-3 text-sm text-slate-300">{c._count?.users || 0}</td>
                        <td className="px-4 py-3 text-sm text-slate-300">{c._count?.sedes || 0}</td>
                        <td className="px-4 py-3 text-sm text-amber-400 font-bold text-right">{c.subscription?.price?.toFixed(2)}€</td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button onClick={() => openEditCompany(c)} className="text-blue-400 hover:text-blue-300 text-xs font-bold mr-2">EDITAR</button>
                          <button onClick={() => handleToggleActive(c)} className={`text-xs font-bold ${c.isActive ? "text-red-400" : "text-green-400"}`}>{c.isActive ? "DESACTIVAR" : "ACTIVAR"}</button>
                        </td>
                      </tr>
                    ))}
                    {companies.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No hay empresas</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ USUARIOS ═══════ */}
        {tab === "users" && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg sm:text-xl font-bold text-white">Usuarios por Empresa</h2>
              <button onClick={() => { if (!selectedCompanyId) { addToast("Selecciona una empresa", "error"); return; } setShowUserModal(true); }}
                className="bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white font-bold px-3 py-2 rounded-lg text-xs sm:text-sm transition">
                + Nuevo
              </button>
            </div>
            <div className="mb-3">
              <select value={selectedCompanyId} onChange={e => { setSelectedCompanyId(e.target.value); if (e.target.value) fetchCompanyUsers(e.target.value); }}
                className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm font-bold w-full max-w-sm">
                <option value="">-- Selecciona empresa --</option>
                {companies.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {selectedCompanyId ? (
              <>
                {/* Mobile: cards */}
                <div className="sm:hidden space-y-2">
                  {companyUsers.map((u: any) => (
                    <div key={u.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold text-white">{u.name}</div>
                        <div className="text-xs text-slate-400">{u.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          u.role === "COMPANY_ADMIN" ? "bg-[#2E5D3A]/30 text-[#6BBE7A]" : "bg-slate-600/30 text-slate-300"
                        }`}>{u.role === "COMPANY_ADMIN" ? "Admin" : "Usuario"}</span>
                        <button onClick={() => handleDeleteUser(u.id)} className="text-red-400 text-xs font-bold">✕</button>
                      </div>
                    </div>
                  ))}
                  {companyUsers.length === 0 && <div className="text-center text-slate-500 py-6">Sin usuarios</div>}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead><tr className="bg-slate-900 border-b border-slate-700">
                        <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Nombre</th>
                        <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Email</th>
                        <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Rol</th>
                        <th className="text-center px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Acciones</th>
                      </tr></thead>
                      <tbody>
                        {companyUsers.map((u: any) => (
                          <tr key={u.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                            <td className="px-4 py-3 text-sm font-bold text-white">{u.name}</td>
                            <td className="px-4 py-3 text-sm text-slate-300">{u.email}</td>
                            <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-1 rounded ${u.role === "COMPANY_ADMIN" ? "bg-[#2E5D3A]/30 text-[#6BBE7A]" : "bg-slate-600/30 text-slate-300"}`}>{u.role === "COMPANY_ADMIN" ? "Admin" : "Usuario"}</span></td>
                            <td className="px-4 py-3 text-center"><button onClick={() => handleDeleteUser(u.id)} className="text-red-400 hover:text-red-300 text-xs font-bold">ELIMINAR</button></td>
                          </tr>
                        ))}
                        {companyUsers.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Sin usuarios</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center text-slate-500">Selecciona una empresa</div>
            )}
          </div>
        )}
      </div>

      {/* ═══════ MODAL: EMPRESA ═══════ */}
      {showCompanyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3" onClick={() => setShowCompanyModal(false)}>
          <div className="bg-slate-800 border border-slate-600 rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">{editCompany ? "Editar Empresa" : "Nueva Empresa"}</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Nombre</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" /></div>
                <div><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Slug</label>
                  <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Plan</label>
                  <select value={form.planName} onChange={e => setForm(f => ({ ...f, planName: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm">
                    <option value="BASIC">Básico</option><option value="PRO">Profesional</option><option value="ENTERPRISE">Empresa</option></select></div>
                <div><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Facturación</label>
                  <select value={form.billingMethod} onChange={e => setForm(f => ({ ...f, billingMethod: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm">
                    <option value="MONTHLY">Mensual</option><option value="QUARTERLY">Trimestral</option><option value="ANNUAL">Anual</option></select></div>
                <div><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Precio (€)</label>
                  <input type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" /></div>
              </div>
              <div className="border-t border-slate-700 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">NIF/CIF</label>
                  <input value={form.nif} onChange={e => setForm(f => ({ ...f, nif: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" /></div>
                <div><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Teléfono</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" /></div>
                <div><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Email</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" /></div>
                <div><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Logo URL</label>
                  <input value={form.logoUrl} onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" /></div>
              </div>
              <div className="border-t border-slate-700 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2"><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Dirección</label>
                  <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" /></div>
                <div><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Ciudad</label>
                  <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" /></div>
                <div><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Provincia</label>
                  <input value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" /></div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleSaveCompany} className="flex-1 bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white font-bold py-2 rounded-lg text-sm transition">{editCompany ? "GUARDAR" : "CREAR"}</button>
              <button onClick={() => { setShowCompanyModal(false); setEditCompany(null); }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg text-sm transition">CANCELAR</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ MODAL: USUARIO ═══════ */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3" onClick={() => setShowUserModal(false)}>
          <div className="bg-slate-800 border border-slate-600 rounded-2xl p-4 sm:p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Nuevo Usuario</h3>
            <div className="space-y-3">
              <div><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Nombre</label>
                <input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" placeholder="Nombre completo" /></div>
              <div><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Email</label>
                <input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" placeholder="usuario@empresa.com" /></div>
              <div><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Contraseña</label>
                <input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" placeholder="••••••••" /></div>
              <div><label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Rol</label>
                <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm">
                  <option value="COMPANY_ADMIN">Administrador</option><option value="USER">Usuario</option></select></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={handleCreateUser} className="flex-1 bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white font-bold py-2 rounded-lg text-sm transition">CREAR</button>
              <button onClick={() => setShowUserModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg text-sm transition">CANCELAR</button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-lg text-sm font-bold shadow-xl ${t.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
            {t.type === "success" ? "✓" : "✗"} {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
