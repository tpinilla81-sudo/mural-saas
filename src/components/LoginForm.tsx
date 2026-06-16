"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) setError("Email o contraseña incorrectos");
  };

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
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm focus:border-[#2E5D3A] focus:outline-none focus:ring-1 focus:ring-[#2E5D3A]/30 placeholder-gray-300"
                placeholder="admin@mural.es"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1.5 tracking-wider">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm focus:border-[#2E5D3A] focus:outline-none focus:ring-1 focus:ring-[#2E5D3A]/30 placeholder-gray-300"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#3b6fb5] hover:bg-[#2d5a9e] disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm transition shadow-md"
            >
              {loading ? "Accediendo..." : "Iniciar Sesión"}
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
