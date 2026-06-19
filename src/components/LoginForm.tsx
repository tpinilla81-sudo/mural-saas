"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

interface LoginUser {
  id: string;
  email: string;
  name: string;
  role: string;
  companyName: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  COMPANY_ADMIN: "Admin Empresa",
  USER: "Usuario",
};

export default function LoginForm() {
  const [users, setUsers] = useState<LoginUser[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingList, setLoadingList] = useState(true);

  useEffect(() => {
    fetch("/api/auth/login-users")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data);
          if (data.length > 0) setSelected(data[0].email);
        }
      })
      .catch(() => setError("No se pudo cargar la lista de usuarios"))
      .finally(() => setLoadingList(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setError("Selecciona un usuario");
      return;
    }
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email: selected, redirect: false });
    setLoading(false);
    if (res?.error) setError("No se pudo iniciar sesión");
  };

  // Group users: SUPER_ADMIN first, then by company
  const superAdmins = users.filter(u => u.role === "SUPER_ADMIN");
  const companyUsers = users.filter(u => u.role !== "SUPER_ADMIN");

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        background: "linear-gradient(180deg, #0a1628 0%, #162a4a 100%)",
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(180deg, #0a1628 0%, #162a4a 100%)`,
        backgroundSize: "20px 20px, 100% 100%",
      }}
    >
      <div className="w-full max-w-sm">
        {/* White card */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          {/* Logo + Branding */}
          <div className="flex flex-col items-center mb-6">
            <img
              src="/logo.jpeg"
              alt="Mural by Método"
              className="h-20 w-20 rounded-full mb-3 shadow-md object-cover"
            />
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">MURAL</h1>
            <p className="text-sm mt-0.5">
              <span className="text-gray-400 font-medium">by </span>
              <span className="text-[#2E5D3A] font-bold tracking-wide">MÉTODO</span>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-bold text-center">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">
                Entrar como:
              </label>
              {loadingList ? (
                <div className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-400 text-sm italic">
                  Cargando usuarios...
                </div>
              ) : (
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm focus:border-[#2E5D3A] focus:outline-none focus:ring-1 focus:ring-[#2E5D3A]/30"
                  size={Math.min(Math.max(users.length + 1, 4), 8)}
                >
                  {superAdmins.length > 0 && (
                    <optgroup label="Super Admin">
                      {superAdmins.map(u => (
                        <option key={u.id} value={u.email}>
                          {u.name} ({u.email})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {companyUsers.length > 0 && (
                    <optgroup label="Usuarios de Empresa">
                      {companyUsers.map(u => (
                        <option key={u.id} value={u.email}>
                          {u.name} — {ROLE_LABEL[u.role] || u.role}
                          {u.companyName ? ` · ${u.companyName}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
              <p className="text-[11px] text-gray-400 mt-1.5">
                {users.length > 0
                  ? `${users.length} usuario(s) disponible(s). Selecciona y entra.`
                  : "No hay usuarios configurados."}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !selected}
              className="w-full bg-[#3b6fb5] hover:bg-[#2d5a9e] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition shadow-md"
            >
              {loading ? "Accediendo..." : "Entrar"}
            </button>
          </form>

          <p className="text-center text-xs text-gray-300 mt-5">
            Acceso exclusivo para usuarios autorizados
          </p>
        </div>
      </div>
    </div>
  );
}
