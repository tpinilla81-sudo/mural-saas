"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import LoginForm from "@/components/LoginForm";
import SuperAdminDashboard from "@/components/SuperAdminDashboard";
import CompanyDashboard from "@/components/CompanyDashboard";
import UserView from "@/components/UserView";

export default function AppShell() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "loading") setLoading(false);
  }, [status]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#0b1120" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-white font-bold text-lg">MURAL</span>
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
      <nav className="bg-black px-6 py-3 flex items-center gap-4 flex-wrap border-b-2 border-amber-500 shrink-0">
        <div className="flex items-center gap-3 mr-6">
          <div className="bg-white p-1.5 rounded-lg">
            <span className="font-black text-black text-lg">M</span>
          </div>
          <div>
            <div className="text-amber-500 font-black text-lg leading-none">MURAL</div>
            <div className="text-white text-xs font-bold tracking-widest">SCHEDULING SaaS</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4">
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
      </nav>

      <main className="flex-1 overflow-hidden">
        {role === "SUPER_ADMIN" && <SuperAdminDashboard />}
        {role === "COMPANY_ADMIN" && <CompanyDashboard />}
        {role === "USER" && <UserView />}
      </main>
    </div>
  );
}
