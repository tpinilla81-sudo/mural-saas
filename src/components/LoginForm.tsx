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
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="flex flex-col items-center">
            <img src="/logo.png" alt="Mural by Método" className="h-20 w-20 sm:h-24 sm:w-24 mb-3" />
            <h1 className="text-2xl sm:text-3xl font-black text-black">Mural</h1>
            <p className="text-[#2E5D3A] font-bold tracking-widest text-xs sm:text-sm mt-1">by Método</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-8 space-y-4 shadow-lg">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 text-center">Iniciar sesión</h2>

          {error && (
            <div className="bg-red-50 border border-red-300 text-red-600 px-4 py-3 rounded-lg text-sm font-bold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-extrabold text-[#2E5D3A] uppercase mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-[#2E5D3A] focus:outline-none"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-[#2E5D3A] uppercase mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm focus:border-[#2E5D3A] focus:outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2E5D3A] hover:bg-[#3a7a4c] disabled:opacity-50 text-white font-extrabold py-3 rounded-lg text-sm transition"
          >
            {loading ? "Accediendo..." : "ACCEDER"}
          </button>
        </form>
      </div>
    </div>
  );
}
