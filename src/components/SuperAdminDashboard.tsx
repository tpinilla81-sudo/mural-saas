"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

type Company = any;
type Payment = any;

export default function SuperAdminDashboard() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<"companies" | "billing" | "stats">("companies");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", planName: "BASIC", billingMethod: "MONTHLY", price: 29.99 });

  async function fetchCompanies() {
    const res = await fetch("/api/admin/companies");
    if (res.ok) setCompanies(await res.json());
  }
  async function fetchPayments() {
    const res = await fetch("/api/admin/payments");
    if (res.ok) setPayments(await res.json());
  }
  async function fetchStats() {
    const res = await fetch("/api/admin/stats");
    if (res.ok) setStats(await res.json());
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchCompanies();
      if (tab === "billing") await fetchPayments();
      if (tab === "stats") await fetchStats();
      setLoading(false);
    };
    load();
  }, [tab]);

  const handleSaveCompany = async () => {
    if (editCompany) {
      await fetch(`/api/admin/companies/${editCompany.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, slug: form.slug, isActive: editCompany.isActive }),
      });
      await fetch(`/api/admin/companies/${editCompany.id}/subscription`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName: form.planName, billingMethod: form.billingMethod, price: form.price }),
      });
    } else {
      await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setShowCompanyModal(false);
    setEditCompany(null);
    fetchCompanies();
  };

  const handleToggleActive = async (company: Company) => {
    await fetch(`/api/admin/companies/${company.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...company, isActive: !company.isActive }),
    });
    fetchCompanies();
  };

  const openEditCompany = (c: Company) => {
    setEditCompany(c);
    setForm({
      name: c.name,
      slug: c.slug,
      planName: c.subscription?.planName || "BASIC",
      billingMethod: c.subscription?.billingMethod || "MONTHLY",
      price: c.subscription?.price || 29.99,
    });
    setShowCompanyModal(true);
  };

  const openNewCompany = () => {
    setEditCompany(null);
    setForm({ name: "", slug: "", planName: "BASIC", billingMethod: "MONTHLY", price: 29.99 });
    setShowCompanyModal(true);
  };

  const handleAddPayment = async (payForm: any) => {
    await fetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payForm),
    });
    setShowPaymentModal(false);
    fetchPayments();
  };

  const planColors: Record<string, string> = { BASIC: "bg-slate-600", PRO: "bg-blue-600", ENTERPRISE: "bg-amber-500" };
  const statusColors: Record<string, string> = { ACTIVE: "text-green-400", TRIAL: "text-blue-400", PAST_DUE: "text-red-400", CANCELLED: "text-slate-500" };
  const tabs = [
    { key: "companies" as const, label: "🏢 EMPRESAS" },
    { key: "billing" as const, label: "💳 FACTURACIÓN" },
    { key: "stats" as const, label: "📊 ESTADÍSTICAS" },
  ];

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="flex gap-3 mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 rounded-lg font-bold text-sm transition ${
              tab === t.key ? "bg-amber-500 text-black" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === "companies" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Empresas</h2>
              <button onClick={openNewCompany} className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-2 rounded-lg text-sm transition">
                + Nueva empresa
              </button>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-700">
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Empresa</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Plan</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Prof.</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Sedes</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Precio</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.id} className={`border-b border-slate-700/50 ${!c.isActive ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-white">{c.name}</div>
                        <div className="text-xs text-slate-500">{c.slug}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`${planColors[c.subscription?.planName || "BASIC"]} text-white text-xs font-bold px-2 py-1 rounded`}>
                          {c.subscription?.planName || "BASIC"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold text-sm ${statusColors[c.subscription?.status || "TRIAL"]}`}>
                          {c.subscription?.status || "TRIAL"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">{c._count?.professionals || 0}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{c._count?.sedes || 0}</td>
                      <td className="px-4 py-3 text-sm font-bold text-amber-400">
                        {c.subscription?.price ? `${c.subscription.price}€` : "—"}
                        <span className="text-xs text-slate-500 ml-1">{c.subscription?.billingMethod?.toLowerCase()}</span>
                      </td>
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => openEditCompany(c)} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-xs font-bold transition">✏️</button>
                        <button onClick={() => handleToggleActive(c)} className={`${c.isActive ? "bg-red-600/30 text-red-400 hover:bg-red-600/50" : "bg-green-600/30 text-green-400 hover:bg-green-600/50"} px-3 py-1 rounded text-xs font-bold transition`}>
                          {c.isActive ? "Suspender" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "billing" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Facturación</h2>
              <button onClick={() => setShowPaymentModal(true)} className="bg-blue-500 hover:bg-blue-400 text-white font-bold px-4 py-2 rounded-lg text-sm transition">
                + Nuevo pago
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {["CARD", "TRANSFER", "CASH"].map((method) => {
                const methodPayments = payments.filter((p: Payment) => p.method === method && p.status === "PAID");
                const total = methodPayments.reduce((s: number, p: Payment) => s + (p.amount || 0), 0);
                const icons: Record<string, string> = { CARD: "💳", TRANSFER: "🏦", CASH: "💵" };
                return (
                  <div key={method} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                    <div className="text-2xl mb-2">{icons[method]}</div>
                    <div className="text-xs text-slate-400 font-bold uppercase">{method}</div>
                    <div className="text-2xl font-black text-white mt-1">{total.toFixed(2)}€</div>
                    <div className="text-xs text-slate-500">{methodPayments.length} pagos</div>
                  </div>
                );
              })}
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-700">
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Empresa</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Importe</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Método</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p: Payment) => (
                    <tr key={p.id} className="border-b border-slate-700/50">
                      <td className="px-4 py-3 text-sm font-bold">{p.subscription?.company?.name || "—"}</td>
                      <td className="px-4 py-3 text-sm font-bold text-amber-400">{p.amount}€</td>
                      <td className="px-4 py-3 text-sm">{p.method}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${
                          p.status === "PAID" ? "bg-green-600/30 text-green-400" :
                          p.status === "PENDING" ? "bg-amber-600/30 text-amber-400" :
                          p.status === "FAILED" ? "bg-red-600/30 text-red-400" : "bg-slate-600/30 text-slate-400"
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{p.dueDate ? new Date(p.dueDate).toLocaleDateString("es-ES") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "stats" && stats && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Estadísticas globales</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Empresas", value: stats.totalCompanies, icon: "🏢", color: "text-amber-400" },
                { label: "Suscripciones activas", value: stats.activeSubs, icon: "✅", color: "text-green-400" },
                { label: "Ingresos totales", value: `${(stats.totalRevenue || 0).toFixed(2)}€`, icon: "💰", color: "text-amber-400" },
                { label: "Profesionales", value: stats.totalProfessionals, icon: "👷", color: "text-blue-400" },
              ].map((s, i) => (
                <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                  <div className="text-2xl mb-2">{s.icon}</div>
                  <div className="text-xs text-slate-400 font-bold uppercase">{s.label}</div>
                  <div className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <h3 className="font-bold text-white mb-3">Ingresos por método</h3>
                {(stats.paymentsByMethod || []).map((m: any, i: number) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-slate-700/50">
                    <span className="text-sm font-bold text-slate-300">{m.method}</span>
                    <span className="text-sm font-bold text-amber-400">{(m._sum.amount || 0).toFixed(2)}€ ({m._count} pagos)</span>
                  </div>
                ))}
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <h3 className="font-bold text-white mb-3">Suscripciones por plan</h3>
                {(stats.paymentsByPlan || []).map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-slate-700/50">
                    <span className="text-sm font-bold text-slate-300">{p.planName}</span>
                    <span className="text-sm font-bold text-blue-400">{p._count} empresas</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Company Modal */}
      {showCompanyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowCompanyModal(false)}>
          <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">{editCompany ? "Editar empresa" : "Nueva empresa"}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Nombre</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Slug</label>
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" placeholder="mi-empresa" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Plan</label>
                  <select value={form.planName} onChange={(e) => {
                    const p = e.target.value;
                    setForm({ ...form, planName: p, price: p === "ENTERPRISE" ? 199.99 : p === "PRO" ? 79.99 : 29.99 });
                  }} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm">
                    <option value="BASIC">BASIC</option>
                    <option value="PRO">PRO</option>
                    <option value="ENTERPRISE">ENTERPRISE</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Facturación</label>
                  <select value={form.billingMethod} onChange={(e) => setForm({ ...form, billingMethod: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm">
                    <option value="MONTHLY">Mensual</option>
                    <option value="QUARTERLY">Trimestral</option>
                    <option value="ANNUAL">Anual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Precio €</label>
                  <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveCompany} className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2 rounded-lg text-sm transition">GUARDAR</button>
                <button onClick={() => { setShowCompanyModal(false); setEditCompany(null); }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg text-sm transition">CANCELAR</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentFormModal companies={companies} onSave={handleAddPayment} onClose={() => setShowPaymentModal(false)} />
      )}
    </div>
  );
}

function PaymentFormModal({ companies, onSave, onClose }: { companies: any[]; onSave: (f: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({ subscriptionId: "", companyId: "", amount: 0, method: "CARD", dueDate: "", status: "PENDING" });

  const handleCompanyChange = async (companyId: string) => {
    setForm({ ...form, companyId });
    const res = await fetch(`/api/admin/companies/${companyId}/subscription`);
    if (res.ok) {
      const sub = await res.json();
      setForm((f) => ({ ...f, subscriptionId: sub.id, amount: sub.price }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-4">Nuevo pago</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Empresa</label>
            <select value={form.companyId} onChange={(e) => handleCompanyChange(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm">
              <option value="">Seleccionar...</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Importe €</label>
              <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) })} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" />
            </div>
            <div>
              <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Método</label>
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm">
                <option value="CARD">Tarjeta</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CASH">Efectivo</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Fecha vencimiento</label>
            <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" />
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => onSave(form)} className="flex-1 bg-blue-500 hover:bg-blue-400 text-white font-bold py-2 rounded-lg text-sm transition">CREAR PAGO</button>
            <button onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg text-sm transition">CANCELAR</button>
          </div>
        </div>
      </div>
    </div>
  );
}
