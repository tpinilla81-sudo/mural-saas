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
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0b1120" }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl mb-4 shadow-lg">
            <span className="font-black text-3xl text-black">M</span>
          </div>
          <h1 className="text-3xl font-black text-amber-500">MURAL</h1>
          <p className="text-slate-400 font-bold tracking-widest text-sm mt-1">SCHEDULING SaaS</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800/80 border border-slate-700 rounded-2xl p-8 space-y-5 shadow-2xl">
          <h2 className="text-xl font-bold text-white text-center">Iniciar sesión</h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-sm font-bold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
              placeholder="tu@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-amber-500 focus:outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-extrabold py-3 rounded-lg text-sm transition"
          >
            {loading ? "Accediendo..." : "ACCEDER"}
          </button>

          <div className="text-center text-xs text-slate-500 mt-4 space-y-1">
            <p><span className="text-slate-400 font-bold">Super Admin:</span> admin@mural.app / admin123</p>
            <p><span className="text-slate-400 font-bold">Empresa:</span> mural@mural.app / mural123</p>
            <p><span className="text-slate-400 font-bold">Usuario:</span> alma@mural.app / user123</p>
          </div>
        </form>
      </div>
    </div>
  );
}
