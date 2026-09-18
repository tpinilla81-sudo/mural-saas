"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginForm() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Introduce la contraseña");
      return;
    }
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Contraseña incorrecta");
      setPassword("");
    }
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
          {/* Logo MURAL */}
          <div className="flex flex-col items-center mb-6">
            <img
              src="/mural-logo.png"
              alt="MURAL Plastic Surgery"
              className="w-44 h-auto mb-3"
            />
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
                Contraseña:
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit(e as any);
                }}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-gray-900 text-lg focus:border-[#2E5D3A] focus:outline-none focus:ring-1 focus:ring-[#2E5D3A]/30"
                placeholder="Introduce la contraseña"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password}
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
