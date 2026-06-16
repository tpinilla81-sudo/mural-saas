"use client";

import { useState, useEffect } from "react";

interface CompanyProfile {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  nif: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  subscription?: {
    planName: string;
    status: string;
    billingMethod: string;
    price: number;
  };
}

interface CompanyUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}

type Toast = { id: number; message: string; type: "success" | "error" };
type Section = "datos" | "usuarios";

export default function CompanyProfileTab() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<Section>("datos");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [form, setForm] = useState({
    name: "", address: "", city: "", province: "", postalCode: "",
    nif: "", phone: "", email: "", website: "", logoUrl: "",
  });

  const [userForm, setUserForm] = useState({ name: "", email: "", role: "USER" });
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);

  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  useEffect(() => {
    async function load() {
      try {
        const [pRes, uRes] = await Promise.all([
          fetch("/api/company/profile"),
          fetch("/api/company/users"),
        ]);
        if (pRes.ok) {
          const data = await pRes.json();
          setProfile(data);
          setForm({
            name: data.name || "", address: data.address || "", city: data.city || "",
            province: data.province || "", postalCode: data.postalCode || "",
            nif: data.nif || "", phone: data.phone || "", email: data.email || "",
            website: data.website || "", logoUrl: data.logoUrl || "",
          });
        }
        if (uRes.ok) setUsers(await uRes.json());
      } catch {
        addToast("Error al cargar datos", "error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch("/api/company/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setProfile(await res.json());
        addToast("Perfil actualizado");
      } else {
        addToast("Error al guardar", "error");
      }
    } catch {
      addToast("Error de conexión", "error");
    } finally {
      setSaving(false);
    }
  }

  async function createUser() {
    if (!userForm.name || !userForm.email) {
      addToast("Nombre y email son obligatorios", "error"); return;
    }
    const res = await fetch("/api/company/users", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm),
    });
    if (res.ok) {
      addToast("Usuario creado");
      setShowUserModal(false);
      setUserForm({ name: "", email: "", role: "USER" });
      const uRes = await fetch("/api/company/users");
      if (uRes.ok) setUsers(await uRes.json());
    } else {
      const data = await res.json().catch(() => ({}));
      addToast(data.error || "Error creando usuario", "error");
    }
  }

  async function deleteUser(id: string) {
    if (!confirm("¿Eliminar este usuario?")) return;
    const res = await fetch(`/api/company/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      addToast("Usuario eliminado");
      setUsers(prev => prev.filter(u => u.id !== id));
    } else {
      const data = await res.json().catch(() => ({}));
      addToast(data.error || "Error", "error");
    }
  }

  async function toggleUserActive(user: CompanyUser) {
    const res = await fetch(`/api/company/users/${user.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, ...updated } : u));
      addToast(updated.isActive ? "Usuario activado" : "Usuario desactivado");
    }
  }

  async function changeUserRole(user: CompanyUser, role: string) {
    const res = await fetch(`/api/company/users/${user.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role } : u));
      addToast("Rol actualizado");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-[#2E5D3A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const planLabels: Record<string, string> = { BASIC: "Básico", PRO: "Profesional", ENTERPRISE: "Empresa" };

  return (
    <div className="space-y-3 relative">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded-lg text-sm font-bold shadow-lg ${
            t.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 mb-2">
        <button onClick={() => setSection("datos")}
          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
            section === "datos" ? "bg-[#6BBE7A] text-black" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}>
          Datos
        </button>
        <button onClick={() => setSection("usuarios")}
          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
            section === "usuarios" ? "bg-[#6BBE7A] text-black" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}>
          Usuarios ({users.length})
        </button>
      </div>

      {/* ═══════ DATOS ═══════ */}
      {section === "datos" && (
        <>
          {/* Subscription card */}
          {profile?.subscription && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-white text-sm">Suscripción</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#2E5D3A] text-white">
                      {planLabels[profile.subscription.planName] || profile.subscription.planName}
                    </span>
                    <span className={`text-xs font-bold ${
                      profile.subscription.status === "ACTIVE" ? "text-green-400" : "text-blue-400"
                    }`}>
                      {profile.subscription.status === "ACTIVE" ? "Activo" : "Prueba"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black text-amber-400">{profile.subscription.price.toFixed(2)}€</div>
                  <div className="text-xs text-slate-400">{profile.subscription.billingMethod === "MONTHLY" ? "Mensual" : "Anual"}</div>
                </div>
              </div>
            </div>
          )}

          {/* Datos de la Empresa */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
            <h3 className="font-bold text-white mb-3 text-sm">Datos de la Empresa</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Nombre</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#2E5D3A] focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Teléfono</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#2E5D3A] focus:outline-none" placeholder="+34 600 000 000" />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Email</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#2E5D3A] focus:outline-none" placeholder="info@empresa.com" />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Web</label>
                <input value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#2E5D3A] focus:outline-none" placeholder="https://www.empresa.com" />
              </div>
            </div>
          </div>

          {/* Datos Fiscales */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
            <h3 className="font-bold text-white mb-3 text-sm">Datos Fiscales</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">NIF / CIF</label>
                <input value={form.nif} onChange={e => setForm({ ...form, nif: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#2E5D3A] focus:outline-none" placeholder="B12345678" />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Dirección</label>
                <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#2E5D3A] focus:outline-none" placeholder="Calle Mayor, 1" />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Ciudad</label>
                <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#2E5D3A] focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Provincia</label>
                <input value={form.province} onChange={e => setForm({ ...form, province: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#2E5D3A] focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">C.P.</label>
                <input value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#2E5D3A] focus:outline-none" placeholder="28001" />
              </div>
            </div>
          </div>

          {/* Logo */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
            <h3 className="font-bold text-white mb-3 text-sm">Logo y Branding</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">URL del Logo</label>
                <input value={form.logoUrl} onChange={e => setForm({ ...form, logoUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#2E5D3A] focus:outline-none" placeholder="https://www.empresa.com/logo.png" />
              </div>
              <div className="flex items-center justify-center">
                {form.logoUrl ? (
                  <div className="bg-white rounded-xl p-2 flex items-center justify-center">
                    <img src={form.logoUrl} alt="Logo" className="h-14 w-14 object-contain rounded" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                ) : (
                  <div className="bg-slate-900 border border-dashed border-slate-600 rounded-xl p-3 flex items-center justify-center h-16 w-16">
                    <span className="text-slate-600 text-xs text-center">Sin logo</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={saveProfile} disabled={saving}
              className="bg-[#2E5D3A] hover:bg-[#3a7a4c] disabled:opacity-50 text-white font-bold px-5 py-2 rounded-lg text-sm transition">
              {saving ? "Guardando..." : "GUARDAR CAMBIOS"}
            </button>
          </div>
        </>
      )}

      {/* ═══════ USUARIOS ═══════ */}
      {section === "usuarios" && (
        <>
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white text-sm">Usuarios de la Empresa</h3>
            <button onClick={() => setShowUserModal(true)}
              className="bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white font-bold px-3 py-1.5 rounded-lg text-xs transition">
              + Nuevo
            </button>
          </div>

          {/* Mobile: card layout */}
          <div className="sm:hidden space-y-2">
            {users.map(u => (
              <div key={u.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-bold text-white">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    u.role === "COMPANY_ADMIN" ? "bg-[#2E5D3A]/30 text-[#6BBE7A]" : "bg-slate-600/30 text-slate-300"
                  }`}>
                    {u.role === "COMPANY_ADMIN" ? "Admin" : "Usuario"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <select value={u.role} onChange={e => changeUserRole(u, e.target.value)}
                    className="flex-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-xs">
                    <option value="COMPANY_ADMIN">Admin</option>
                    <option value="USER">Usuario</option>
                  </select>
                  <button onClick={() => toggleUserActive(u)}
                    className={`px-2 py-1 rounded text-xs font-bold ${u.isActive ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}`}>
                    {u.isActive ? "Activo" : "Inactivo"}
                  </button>
                  <button onClick={() => deleteUser(u)} className="px-2 py-1 rounded text-xs font-bold bg-red-600/20 text-red-400">✕</button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="text-center text-slate-500 py-8">No hay usuarios</div>
            )}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden sm:block bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900">
                    <th className="text-left px-4 py-2 text-xs font-extrabold text-blue-400 uppercase">Nombre</th>
                    <th className="text-left px-4 py-2 text-xs font-extrabold text-blue-400 uppercase">Email</th>
                    <th className="text-left px-4 py-2 text-xs font-extrabold text-blue-400 uppercase">Rol</th>
                    <th className="text-center px-4 py-2 text-xs font-extrabold text-blue-400 uppercase">Estado</th>
                    <th className="text-center px-4 py-2 text-xs font-extrabold text-blue-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="px-4 py-2 text-sm font-bold text-white">{u.name}</td>
                      <td className="px-4 py-2 text-sm text-slate-300">{u.email}</td>
                      <td className="px-4 py-2">
                        <select value={u.role} onChange={e => changeUserRole(u, e.target.value)}
                          className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-xs">
                          <option value="COMPANY_ADMIN">Admin</option>
                          <option value="USER">Usuario</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => toggleUserActive(u)}
                          className={`text-xs font-bold px-2 py-1 rounded ${
                            u.isActive ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"
                          }`}>
                          {u.isActive ? "Activo" : "Inactivo"}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => deleteUser(u)} className="text-red-400 hover:text-red-300 text-xs font-bold">ELIMINAR</button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No hay usuarios</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ═══════ MODAL: NUEVO USUARIO ═══════ */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowUserModal(false)}>
          <div className="bg-slate-800 border border-slate-600 rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">Nuevo Usuario</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Nombre</label>
                <input value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" placeholder="Nombre completo" />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Email</label>
                <input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" placeholder="usuario@empresa.com" />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Rol</label>
                <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm">
                  <option value="COMPANY_ADMIN">Administrador</option>
                  <option value="USER">Usuario</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={createUser} className="flex-1 bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white font-bold py-2 rounded-lg text-sm transition">CREAR</button>
              <button onClick={() => setShowUserModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg text-sm transition">CANCELAR</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
