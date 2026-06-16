"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import LoginForm from "@/components/LoginForm";
import SuperAdminDashboard from "@/components/SuperAdminDashboard";
import CompanyDashboard from "@/components/CompanyDashboard";
import UserView from "@/components/UserView";

export default function AppShell() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (status !== "loading") setLoading(false);
  }, [status]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0b1120" }}>
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.jpeg" alt="Mural by Método" className="h-12 w-12 rounded-full animate-pulse object-cover" />
          <span className="text-white font-bold text-base">Mural by Método</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginForm />;
  }

  const role = (session.user as any)?.role;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0b1120", color: "#f1f5f9" }}>
      {/* Navbar */}
      <nav className="bg-black px-3 sm:px-6 py-3 flex items-center gap-3 border-b-2 border-[#6BBE7A] shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <img src="/logo.jpeg" alt="Mural by Método" className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover" />
          <div>
            <div className="text-[#6BBE7A] font-black text-base sm:text-lg leading-none">Mural</div>
            <div className="text-[#2E5D3A] text-[10px] sm:text-xs font-bold tracking-widest">by Método</div>
          </div>
        </div>

        {/* Desktop: show user + logout */}
        <div className="ml-auto hidden sm:flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-bold">{session.user?.name}</div>
            <div className="text-xs text-slate-400">
              {role === "SUPER_ADMIN" ? "Super Admin" : role === "COMPANY_ADMIN" ? (session.user as any)?.companyName : "Usuario"}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Mobile: hamburger */}
        <div className="ml-auto sm:hidden">
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
    </div>
  );
}
