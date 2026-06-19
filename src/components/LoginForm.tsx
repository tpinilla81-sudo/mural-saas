"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";

interface LoginUser {
  id: string;
  email: string;
  name: string;
  role: string;
  companyName: string | null;
  hasPin: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  COMPANY_ADMIN: "Admin Empresa",
  USER: "Usuario",
};

export default function LoginForm() {
  const [users, setUsers] = useState<LoginUser[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [pin, setPin] = useState("");
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

  // Reset PIN field whenever the selected user changes
  useEffect(() => { setPin(""); setError(""); }, [selected]);

  const selectedUser = users.find(u => u.email === selected);
  const needsPin = !!selectedUser?.hasPin;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setError("Selecciona un usuario");
      return;
    }
    if (needsPin && pin.length !== 4) {
      setError("Introduce el PIN de 4 dígitos");
      return;
    }
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email: selected,
      ...(needsPin ? { pin } : {}),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) setError(needsPin ? "PIN incorrecto" : "No se pudo iniciar sesión");
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
          {/* Generic access header — no branding */}
          <div className="flex flex-col items-center mb-6">
            <div className="h-20 w-20 rounded-full mb-3 bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300">
              <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0-1.657 1.343-3 3-3s3 1.343 3 3-1.343 3-3 3-3-1.343-3-3z M5 11c0-1.657 1.343-3 3-3s3 1.343 3 3-1.343 3-3 3-3-1.343-3-3z M3 21v-2a4 4 0 014-4h10a4 4 0 014 4v2" />
              </svg>
            </div>
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
                          {u.name} ({u.email}){u.hasPin ? " 🔒" : ""}
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
                          {u.hasPin ? " 🔒" : ""}
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

            {/* PIN field — only shown when the selected user has a PIN configured */}
            {needsPin && (
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">
                  PIN:
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  autoFocus
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 text-2xl tracking-[0.5em] font-mono text-center focus:border-[#2E5D3A] focus:outline-none focus:ring-1 focus:ring-[#2E5D3A]/30"
                  placeholder="••••"
                />
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Este usuario tiene un PIN configurado. Introduce los 4 dígitos para continuar.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !selected || (needsPin && pin.length !== 4)}
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
