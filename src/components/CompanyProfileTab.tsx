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

interface ProPermission {
  professional: {
    id: string;
    firstName: string;
    lastName: string;
    alias: string;
    email: string;
    phone: string;
    assignedSedes: string;
  };
  user: {
    id: string;
    email: string;
    name: string;
    isActive: boolean;
    permissions: {
      view_diario: boolean;
      view_mensual: boolean;
      view_own_only: boolean;
      view_assigned_sedes: boolean;
    };
  } | null;
  canLogin: boolean;
}

type Toast = { id: number; message: string; type: "success" | "error" };
type Section = "datos" | "usuarios" | "permisos";

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
  const [proPerms, setProPerms] = useState<ProPermission[]>([]);
  const [permsLoading, setPermsLoading] = useState(false);
  const [permsSavingId, setPermsSavingId] = useState<string | null>(null);

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

  useEffect(() => {
    if (section === "permisos") loadProPerms();
  }, [section]);

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

  async function loadProPerms() {
    setPermsLoading(true);
    try {
      const res = await fetch("/api/company/permissions");
      if (res.ok) setProPerms(await res.json());
    } catch {
      // ignore
    } finally {
      setPermsLoading(false);
    }
  }

  async function updateProPermissions(
    proId: string,
    changes: {
      canLogin?: boolean;
      view_diario?: boolean;
      view_mensual?: boolean;
      view_own_only?: boolean;
      view_assigned_sedes?: boolean;
    }
  ) {
    // Find the current state and merge changes
    const current = proPerms.find(p => p.professional.id === proId);
    if (!current) return;
    const body = {
      professionalId: proId,
      canLogin: changes.canLogin !== undefined ? changes.canLogin : current.canLogin,
      view_diario: changes.view_diario !== undefined ? changes.view_diario : (current.user?.permissions.view_diario ?? false),
      view_mensual: changes.view_mensual !== undefined ? changes.view_mensual : (current.user?.permissions.view_mensual ?? false),
      view_own_only: changes.view_own_only !== undefined ? changes.view_own_only : (current.user?.permissions.view_own_only ?? false),
      view_assigned_sedes: changes.view_assigned_sedes !== undefined ? changes.view_assigned_sedes : (current.user?.permissions.view_assigned_sedes ?? false),
    };

    // Optimistic update
    setProPerms(prev => prev.map(p => {
      if (p.professional.id !== proId) return p;
      const newCanLogin = body.canLogin;
      const newPerms = {
        view_diario: body.view_diario,
        view_mensual: body.view_mensual,
        view_own_only: body.view_own_only,
        view_assigned_sedes: body.view_assigned_sedes,
      };
      return {
        ...p,
        canLogin: newCanLogin,
        user: p.user ? { ...p.user, isActive: newCanLogin, permissions: newPerms } : (newCanLogin ? {
          id: "pending",
          email: p.professional.email,
          name: `${p.professional.firstName} ${p.professional.lastName}`,
          isActive: true,
          permissions: newPerms,
        } : null),
      };
    }));

    setPermsSavingId(proId);
    try {
      const res = await fetch("/api/company/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        addToast(data.error || "Error al guardar permisos", "error");
        await loadProPerms();
      } else {
        const data = await res.json();
        // Sync server response
        setProPerms(prev => prev.map(p => p.professional.id === proId ? {
          ...p,
          canLogin: data.canLogin,
          user: data.user,
        } : p));
        addToast("Permisos actualizados");
      }
    } catch {
      addToast("Error de conexión", "error");
      await loadProPerms();
    } finally {
      setPermsSavingId(null);
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
        <button onClick={() => setSection("permisos")}
          className={`px-3 py-1.5 rounded-lg font-bold text-xs transition ${
            section === "permisos" ? "bg-[#6BBE7A] text-black" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}>
          Permisos
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
                  <button onClick={() => deleteUser(u.id)} className="px-2 py-1 rounded text-xs font-bold bg-red-600/20 text-red-400">✕</button>
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
                        <button onClick={() => deleteUser(u.id)} className="text-red-400 hover:text-red-300 text-xs font-bold">ELIMINAR</button>
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

      {/* ═══════ PERMISOS ═══════ */}
      {section === "permisos" && (
        <>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4">
            <h3 className="font-bold text-white text-sm mb-1">Permisos de Profesionales</h3>
            <p className="text-xs text-slate-400 mb-3">
              Activa “Puede entrar” para que el profesional aparezca en el selector del login y pueda acceder con su email.
              Luego marca qué vistas puede ver. El profesional necesita un email válido guardado en la pestaña Profesionales.
            </p>

            {permsLoading ? (
              <div className="text-center py-8 text-slate-400 text-sm">Cargando profesionales…</div>
            ) : proPerms.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-sm">No hay profesionales. Crea primero profesionales en Diário → Profesionales.</div>
            ) : (
              <>
                {/* Mobile: card layout */}
                <div className="sm:hidden space-y-3">
                  {proPerms.map(({ professional: p, user, canLogin }) => {
                    const hasEmail = !!p.email && p.email.includes("@");
                    const perms = user?.permissions || { view_diario: false, view_mensual: false, view_own_only: false, view_assigned_sedes: false };
                    const saving = permsSavingId === p.id;
                    return (
                      <div key={p.id} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate">{p.firstName} {p.lastName}</div>
                            <div className="text-[10px] text-slate-400 truncate">{p.alias} · {p.email || <span className="text-red-400">sin email</span>}</div>
                          </div>
                          <label className="flex items-center gap-1 shrink-0 cursor-pointer">
                            <input
                              type="checkbox"
                              disabled={!hasEmail || saving}
                              checked={canLogin}
                              onChange={e => updateProPermissions(p.id, { canLogin: e.target.checked })}
                              className="accent-[#6BBE7A] w-4 h-4"
                            />
                            <span className="text-[10px] font-bold text-slate-300">Entrar</span>
                          </label>
                        </div>
                        {canLogin && (
                          <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-700">
                            {([
                              ["view_diario", "Ver diario"],
                              ["view_mensual", "Ver mensual"],
                              ["view_own_only", "Solo sus turnos"],
                              ["view_assigned_sedes", "Solo sus sedes"],
                            ] as const).map(([k, label]) => (
                              <label key={k} className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={saving}
                                  checked={perms[k]}
                                  onChange={e => updateProPermissions(p.id, { [k]: e.target.checked })}
                                  className="accent-[#6BBE7A] w-3.5 h-3.5"
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        )}
                        {!hasEmail && (
                          <div className="text-[10px] text-red-400">Añade un email al profesional para poder habilitar el acceso.</div>
                        )}
                        {saving && <div className="text-[10px] text-amber-400">Guardando…</div>}
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block overflow-x-auto rounded-lg border border-slate-700">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-900">
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Profesional</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Email</th>
                        <th className="text-center px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Puede entrar</th>
                        <th className="text-center px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Ver diario</th>
                        <th className="text-center px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Ver mensual</th>
                        <th className="text-center px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Solo sus turnos</th>
                        <th className="text-center px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Solo sus sedes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proPerms.map(({ professional: p, user, canLogin }) => {
                        const hasEmail = !!p.email && p.email.includes("@");
                        const perms = user?.permissions || { view_diario: false, view_mensual: false, view_own_only: false, view_assigned_sedes: false };
                        const saving = permsSavingId === p.id;
                        const cellCls = "px-3 py-2 text-center";
                        return (
                          <tr key={p.id} className={`border-b border-slate-700/50 ${saving ? "opacity-60" : "hover:bg-slate-700/20"}`}>
                            <td className="px-3 py-2 text-sm font-bold text-white">
                              {p.firstName} {p.lastName}
                              <div className="text-[10px] text-slate-400 font-normal">{p.alias}</div>
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-300">
                              {p.email || <span className="text-red-400">sin email</span>}
                            </td>
                            <td className={cellCls}>
                              <input
                                type="checkbox"
                                disabled={!hasEmail || saving}
                                checked={canLogin}
                                onChange={e => updateProPermissions(p.id, { canLogin: e.target.checked })}
                                className="accent-[#6BBE7A] w-4 h-4"
                                title={!hasEmail ? "El profesional necesita un email" : ""}
                              />
                            </td>
                            <td className={cellCls}>
                              <input type="checkbox" disabled={!canLogin || saving} checked={perms.view_diario}
                                onChange={e => updateProPermissions(p.id, { view_diario: e.target.checked })}
                                className="accent-[#6BBE7A] w-4 h-4" />
                            </td>
                            <td className={cellCls}>
                              <input type="checkbox" disabled={!canLogin || saving} checked={perms.view_mensual}
                                onChange={e => updateProPermissions(p.id, { view_mensual: e.target.checked })}
                                className="accent-[#6BBE7A] w-4 h-4" />
                            </td>
                            <td className={cellCls}>
                              <input type="checkbox" disabled={!canLogin || saving} checked={perms.view_own_only}
                                onChange={e => updateProPermissions(p.id, { view_own_only: e.target.checked })}
                                className="accent-[#6BBE7A] w-4 h-4" />
                            </td>
                            <td className={cellCls}>
                              <input type="checkbox" disabled={!canLogin || saving} checked={perms.view_assigned_sedes}
                                onChange={e => updateProPermissions(p.id, { view_assigned_sedes: e.target.checked })}
                                className="accent-[#6BBE7A] w-4 h-4" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
