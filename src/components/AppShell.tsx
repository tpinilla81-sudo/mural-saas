"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import LoginForm from "@/components/LoginForm";
import SuperAdminDashboard from "@/components/SuperAdminDashboard";
import CompanyDashboard from "@/components/CompanyDashboard";
import UserView from "@/components/UserView";
import PushOnboard from "@/components/PushOnboard";
import NotificationCenter from "@/components/NotificationCenter";

export default function AppShell() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  // Branding corporativo (logo + color)
  const [brand, setBrand] = useState<{ name?: string; logoUrl?: string; brandColor?: string }>({});

  useEffect(() => {
    if (status !== "loading") setLoading(false);
  }, [status]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/company/branding").then(r => (r.ok ? r.json() : {})).then(setBrand).catch(() => {});
  }, [session]);

  // Color corporativo → variables CSS que sobrescriben los verdes del panel
  useEffect(() => {
    const c = (brand.brandColor || "").trim();
    if (c && /^#[0-9a-fA-F]{6}$/.test(c)) {
      document.documentElement.style.setProperty("--brand", c);
      document.documentElement.setAttribute("data-brand", "1");
    } else {
      document.documentElement.removeAttribute("data-brand");
    }
  }, [brand]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0b1120" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-2 border-slate-600 border-t-slate-300 animate-spin" />
          <span className="text-slate-400 font-bold text-sm">Cargando…</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginForm />;
  }

  const role = (session.user as any)?.role;

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: "#0b1120", color: "#f1f5f9" }}>
      {/* Navbar */}
      <nav className="bg-black px-3 sm:px-6 py-3 flex items-center gap-3 border-b-2 border-[#6BBE7A] shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Logo corporativo (si hay) o placa MURAL */}
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name || "Logo"} className="h-9 sm:h-10 w-auto object-contain rounded-lg"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <img src="/mural-logo.png" alt="MURAL" className="h-9 sm:h-10 w-auto bg-white rounded-lg px-1.5 shadow-md" />
          )}
          <div className="leading-none hidden sm:block select-none">
            <span className="text-amber-500 font-black text-base tracking-wide">MURAL</span>
            <small className="block text-white text-[9px] font-bold tracking-[2px] mt-0.5">{brand.name || "PLASTIC SURGERY"}</small>
          </div>
        </div>

        {/* Desktop: show user + logout */}
        <div className="ml-auto hidden sm:flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-bold">{session.user?.name}</div>
            <div className="text-xs text-slate-400">
              {role === "SUPER_ADMIN" ? "Super Admin" : role === "COMPANY_ADMIN" ? (session.user as any)?.companyName : "Usuario"}
            </div>
          </div>
          {/* 🔔 campana (interruptor) + 📩 sobre (mensajes no leídos) */}
          <NotificationCenter showInbox={role !== "SUPER_ADMIN"} />
          <a
            href="/coche"
            className="bg-amber-500 hover:bg-amber-400 text-black px-3 py-2 rounded-lg text-sm font-black transition shadow-[0_0_14px_rgba(245,158,11,0.45)]"
            title="Modo Coche: solo manos libres por seguridad (la app pregunta por voz y tú respondes)"
          >
            🚗
          </a>
          <button
            onClick={() => signOut()}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Mobile: hamburger */}
        <div className="ml-auto sm:hidden flex items-center gap-1">
          {/* 🔔 campana (interruptor) + 📩 sobre (mensajes) */}
          <NotificationCenter showInbox={role !== "SUPER_ADMIN"} bare />
          <button onClick={() => setMenuOpen(!menuOpen)} className="text-white p-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="sm:hidden bg-black/95 border-b border-[#6BBE7A]/30 px-4 py-3 space-y-3">
          <div>
            <div className="text-sm font-bold text-white">{session.user?.name}</div>
            <div className="text-xs text-slate-400">
              {role === "SUPER_ADMIN" ? "Super Admin" : role === "COMPANY_ADMIN" ? (session.user as any)?.companyName : "Usuario"}
            </div>
          </div>
          <a
            href="/coche"
            onClick={() => setMenuOpen(false)}
            className="block text-center w-full bg-[#2E5D3A]/30 border border-[#6BBE7A]/50 hover:bg-[#2E5D3A] text-[#6BBE7A] hover:text-white font-bold py-2 rounded-lg text-sm transition"
          >
            🚗 Modo coche
          </a>
          <button
            onClick={() => { signOut(); setMenuOpen(false); }}
            className="w-full bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-bold py-2 rounded-lg text-sm transition"
          >
            Cerrar sesión
          </button>
        </div>
      )}

      <main className="flex-1 overflow-hidden">
        {role === "SUPER_ADMIN" && <SuperAdminDashboard />}
        {role === "COMPANY_ADMIN" && <CompanyDashboard />}
        {role === "USER" && <UserView />}
      </main>

      {/* Como el micrófono: al entrar, pregunta si este móvil quiere recibir avisos */}
      {role !== "SUPER_ADMIN" && <PushOnboard />}
    </div>
  );
}
