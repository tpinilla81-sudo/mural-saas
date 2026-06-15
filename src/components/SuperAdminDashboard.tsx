"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

type Company = any;
type Payment = any;
type RevenueData = any;

export default function SuperAdminDashboard() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<"companies" | "billing" | "revenue" | "invoices">("companies");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [editPayment, setEditPayment] = useState<Payment | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", planName: "BASIC", billingMethod: "MONTHLY", price: 29.99 });
  const [payForm, setPayForm] = useState({ subscriptionId: "", companyId: "", amount: 0, subtotal: 0, method: "CARD", dueDate: "", concept: "", status: "PENDING" });
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterCompany, setFilterCompany] = useState<string>("ALL");
  const [generating, setGenerating] = useState(false);

  async function fetchCompanies() {
    const res = await fetch("/api/admin/companies");
    if (res.ok) setCompanies(await res.json());
  }
  async function fetchPayments() {
    const res = await fetch("/api/admin/payments");
    if (res.ok) setPayments(await res.json());
  }
  async function fetchRevenue() {
    const res = await fetch("/api/admin/revenue");
    if (res.ok) setRevenue(await res.json());
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchCompanies();
      if (tab === "billing" || tab === "invoices") await fetchPayments();
      if (tab === "revenue") await fetchRevenue();
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

  const handleCompanyChange = async (companyId: string) => {
    setPayForm({ ...payForm, companyId });
    const res = await fetch(`/api/admin/companies/${companyId}/subscription`);
    if (res.ok) {
      const sub = await res.json();
      const subtotal = sub.price;
      const taxAmount = Math.round(subtotal * 0.21 * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
      setPayForm((f) => ({ ...f, subscriptionId: sub.id, amount: totalAmount, subtotal }));
    }
  };

  const handleAddPayment = async () => {
    await fetch("/api/admin/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payForm,
        taxRate: 21.0,
        taxAmount: Math.round(payForm.subtotal * 0.21 * 100) / 100,
      }),
    });
    setShowPaymentModal(false);
    setEditPayment(null);
    fetchPayments();
  };

  const handleUpdatePaymentStatus = async (paymentId: string, newStatus: string) => {
    await fetch(`/api/admin/payments/${paymentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchPayments();
  };

  const handleDeletePayment = async (paymentId: string) => {
    await fetch(`/api/admin/payments/${paymentId}`, { method: "DELETE" });
    fetchPayments();
  };

  const handleGenerateInvoices = async () => {
    setGenerating(true);
    const res = await fetch("/api/admin/invoices/generate", { method: "GET" });
    if (res.ok) {
      const data = await res.json();
      alert(`${data.generated} facturas generadas`);
      fetchPayments();
    }
    setGenerating(false);
  };

  const handleGenerateSingleInvoice = async (companyId: string) => {
    const res = await fetch("/api/admin/invoices/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    });
    if (res.ok) {
      fetchPayments();
      fetchCompanies();
    }
  };

  // Filtered payments
  const filteredPayments = payments.filter((p: Payment) => {
    if (filterStatus !== "ALL" && p.status !== filterStatus) return false;
    if (filterCompany !== "ALL" && p.companyId !== filterCompany) return false;
    return true;
  });

  const planColors: Record<string, string> = { BASIC: "bg-slate-600", PRO: "bg-blue-600", ENTERPRISE: "bg-amber-500" };
  const statusColors: Record<string, string> = { ACTIVE: "text-green-400", TRIAL: "text-blue-400", PAST_DUE: "text-red-400", CANCELLED: "text-slate-500" };
  const payStatusColors: Record<string, string> = {
    PAID: "bg-green-600/30 text-green-400",
    PENDING: "bg-amber-600/30 text-amber-400",
    OVERDUE: "bg-red-600/30 text-red-400",
    FAILED: "bg-red-600/30 text-red-400",
    REFUNDED: "bg-slate-600/30 text-slate-400",
  };
  const methodLabels: Record<string, string> = { CARD: "Tarjeta", TRANSFER: "Transferencia", CASH: "Efectivo" };

  const tabs = [
    { key: "companies" as const, label: "EMPRESAS" },
    { key: "billing" as const, label: "FACTURACIÓN" },
    { key: "invoices" as const, label: "FACTURAS" },
    { key: "revenue" as const, label: "INGRESOS" },
  ];

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition ${
              tab === t.key ? "bg-amber-500 text-black" : "bg-slate-700 text-slate-400 hover:bg-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* ==================== COMPANIES TAB ==================== */}
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
                        {c.subscription?.price ? `${c.subscription.price.toFixed(2)}€` : "—"}
                        <span className="text-xs text-slate-500 ml-1">{c.subscription?.billingMethod?.toLowerCase()}</span>
                      </td>
                      <td className="px-4 py-3 flex gap-2">
                        <button onClick={() => openEditCompany(c)} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded text-xs font-bold transition">✏️</button>
                        <button onClick={() => handleGenerateSingleInvoice(c.id)} className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold transition" title="Generar factura">🧾</button>
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

        {/* ==================== BILLING TAB (Overview) ==================== */}
        {tab === "billing" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Facturación</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateInvoices}
                  disabled={generating}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
                >
                  {generating ? "Generando..." : "🔄 Generar facturas automáticas"}
                </button>
                <button onClick={() => { setEditPayment(null); setPayForm({ subscriptionId: "", companyId: "", amount: 0, subtotal: 0, method: "CARD", dueDate: "", concept: "", status: "PENDING" }); setShowPaymentModal(true); }} className="bg-blue-500 hover:bg-blue-400 text-white font-bold px-4 py-2 rounded-lg text-sm transition">
                  + Nuevo pago
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Ingresos Totales", value: `${payments.filter((p: Payment) => p.status === "PAID").reduce((s: number, p: Payment) => s + (p.amount || 0), 0).toFixed(2)}€`, color: "text-green-400", bg: "bg-green-600/10 border-green-600/20" },
                { label: "Pendiente", value: `${payments.filter((p: Payment) => p.status === "PENDING" || p.status === "OVERDUE").reduce((s: number, p: Payment) => s + (p.amount || 0), 0).toFixed(2)}€`, color: "text-amber-400", bg: "bg-amber-600/10 border-amber-600/20" },
                { label: "Facturas Pagadas", value: payments.filter((p: Payment) => p.status === "PAID").length.toString(), color: "text-blue-400", bg: "bg-blue-600/10 border-blue-600/20" },
                { label: "Facturas Vencidas", value: payments.filter((p: Payment) => p.status === "OVERDUE" || (p.status === "PENDING" && new Date(p.dueDate) < new Date())).length.toString(), color: "text-red-400", bg: "bg-red-600/10 border-red-600/20" },
              ].map((s, i) => (
                <div key={i} className={`${s.bg} border rounded-xl p-4`}>
                  <div className="text-xs text-slate-400 font-bold uppercase">{s.label}</div>
                  <div className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Revenue by method */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {["CARD", "TRANSFER", "CASH"].map((method) => {
                const methodPayments = payments.filter((p: Payment) => p.method === method && p.status === "PAID");
                const total = methodPayments.reduce((s: number, p: Payment) => s + (p.amount || 0), 0);
                const icons: Record<string, string> = { CARD: "💳", TRANSFER: "🏦", CASH: "💵" };
                return (
                  <div key={method} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                    <div className="text-2xl mb-2">{icons[method]}</div>
                    <div className="text-xs text-slate-400 font-bold uppercase">{methodLabels[method]}</div>
                    <div className="text-2xl font-black text-white mt-1">{total.toFixed(2)}€</div>
                    <div className="text-xs text-slate-500">{methodPayments.length} pagos</div>
                  </div>
                );
              })}
            </div>

            {/* Recent payments */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700">
                <h3 className="font-bold text-white text-sm">Últimos pagos</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-700">
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Empresa</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Factura</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Importe</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Método</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Vencimiento</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.slice(0, 10).map((p: Payment) => (
                    <tr key={p.id} className="border-b border-slate-700/50">
                      <td className="px-4 py-3 text-sm font-bold text-white">{p.subscription?.company?.name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{p.invoiceNumber || "—"}</td>
                      <td className="px-4 py-3 text-sm font-bold text-amber-400">{p.amount.toFixed(2)}€</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{methodLabels[p.method] || p.method}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${payStatusColors[p.status] || "bg-slate-600/30 text-slate-400"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{p.dueDate ? new Date(p.dueDate).toLocaleDateString("es-ES") : "—"}</td>
                      <td className="px-4 py-3">
                        {p.status === "PENDING" && (
                          <button onClick={() => handleUpdatePaymentStatus(p.id, "PAID")} className="bg-green-600/30 text-green-400 hover:bg-green-600/50 px-2 py-1 rounded text-xs font-bold transition" title="Marcar pagado">
                            ✓ Pagado
                          </button>
                        )}
                        {p.status === "PAID" && (
                          <button onClick={() => handleUpdatePaymentStatus(p.id, "REFUNDED")} className="bg-slate-600/30 text-slate-400 hover:bg-slate-600/50 px-2 py-1 rounded text-xs font-bold transition" title="Reembolsar">
                            ↩ Reembolso
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== INVOICES TAB (Full invoice management) ==================== */}
        {tab === "invoices" && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Gestión de Facturas</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleGenerateInvoices}
                  disabled={generating}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
                >
                  {generating ? "Generando..." : "🔄 Generar todas"}
                </button>
                <button onClick={() => { setEditPayment(null); setPayForm({ subscriptionId: "", companyId: "", amount: 0, subtotal: 0, method: "CARD", dueDate: "", concept: "", status: "PENDING" }); setShowPaymentModal(true); }} className="bg-blue-500 hover:bg-blue-400 text-white font-bold px-4 py-2 rounded-lg text-sm transition">
                  + Nueva factura
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 mb-4 flex-wrap">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
              >
                <option value="ALL">Todos los estados</option>
                <option value="PENDING">Pendiente</option>
                <option value="PAID">Pagado</option>
                <option value="OVERDUE">Vencido</option>
                <option value="FAILED">Fallido</option>
                <option value="REFUNDED">Reembolsado</option>
              </select>
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm"
              >
                <option value="ALL">Todas las empresas</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="text-xs text-slate-500 self-center">{filteredPayments.length} facturas</div>
            </div>

            {/* Invoices Table */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-700">
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Factura</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Empresa</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Concepto</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Base</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">IVA</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Total</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Método</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Vencimiento</th>
                    <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p: Payment) => (
                    <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/20 transition">
                      <td className="px-4 py-3 text-sm font-bold text-white">{p.invoiceNumber || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{p.subscription?.company?.name || "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-400 max-w-[200px] truncate">{p.concept || "Suscripción"}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{(p.subtotal || p.amount).toFixed(2)}€</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{p.taxAmount?.toFixed(2) || "—"}€</td>
                      <td className="px-4 py-3 text-sm font-bold text-amber-400">{p.amount.toFixed(2)}€</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{methodLabels[p.method] || p.method}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-1 rounded ${payStatusColors[p.status] || "bg-slate-600/30 text-slate-400"}`}>
                          {p.status === "PAID" ? "Pagado" : p.status === "PENDING" ? "Pendiente" : p.status === "OVERDUE" ? "Vencido" : p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{p.dueDate ? new Date(p.dueDate).toLocaleDateString("es-ES") : "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {p.status === "PENDING" && (
                            <>
                              <button onClick={() => handleUpdatePaymentStatus(p.id, "PAID")} className="bg-green-600/30 text-green-400 hover:bg-green-600/50 px-2 py-1 rounded text-xs font-bold transition" title="Marcar pagado">✓</button>
                              <button onClick={() => handleUpdatePaymentStatus(p.id, "OVERDUE")} className="bg-red-600/30 text-red-400 hover:bg-red-600/50 px-2 py-1 rounded text-xs font-bold transition" title="Marcar vencido">!</button>
                            </>
                          )}
                          {p.status === "PAID" && (
                            <button onClick={() => handleUpdatePaymentStatus(p.id, "REFUNDED")} className="bg-slate-600/30 text-slate-400 hover:bg-slate-600/50 px-2 py-1 rounded text-xs font-bold transition" title="Reembolsar">↩</button>
                          )}
                          {p.status === "OVERDUE" && (
                            <button onClick={() => handleUpdatePaymentStatus(p.id, "PAID")} className="bg-green-600/30 text-green-400 hover:bg-green-600/50 px-2 py-1 rounded text-xs font-bold transition" title="Marcar pagado">✓</button>
                          )}
                          <button onClick={() => { setEditPayment(p); setPayForm({ subscriptionId: p.subscriptionId, companyId: p.companyId, amount: p.amount, subtotal: p.subtotal || p.amount, method: p.method, dueDate: p.dueDate ? new Date(p.dueDate).toISOString().split("T")[0] : "", concept: p.concept || "", status: p.status }); setShowPaymentModal(true); }} className="bg-slate-600/30 text-slate-400 hover:bg-slate-600/50 px-2 py-1 rounded text-xs font-bold transition" title="Editar">✏️</button>
                          <button onClick={() => { if (confirm("Eliminar factura?")) handleDeletePayment(p.id); }} className="bg-red-600/20 text-red-400 hover:bg-red-600/40 px-2 py-1 rounded text-xs font-bold transition" title="Eliminar">✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredPayments.length === 0 && (
                <div className="p-8 text-center text-slate-500">No hay facturas con los filtros seleccionados</div>
              )}
            </div>
          </div>
        )}

        {/* ==================== REVENUE TAB (Analytics) ==================== */}
        {tab === "revenue" && revenue && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Ingresos & Analíticas</h2>

            {/* Top KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Ingresos Totales", value: `${(revenue.totalRevenue || 0).toFixed(2)}€`, color: "text-green-400" },
                { label: "MRR", value: `${(revenue.mrr || 0).toFixed(2)}€`, color: "text-blue-400" },
                { label: "ARR", value: `${(revenue.arr || 0).toFixed(2)}€`, color: "text-amber-400" },
                { label: "Pendiente", value: `${(revenue.pendingRevenue || 0).toFixed(2)}€`, color: "text-red-400" },
              ].map((s, i) => (
                <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                  <div className="text-xs text-slate-400 font-bold uppercase">{s.label}</div>
                  <div className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Monthly Revenue Chart */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5 mb-6">
              <h3 className="font-bold text-white mb-4">Ingresos Mensuales</h3>
              <div className="flex items-end gap-2 h-48">
                {(revenue.monthlyRevenue || []).map((m: any, i: number) => {
                  const maxVal = Math.max(...(revenue.monthlyRevenue || []).map((x: any) => x.total), 1);
                  const height = Math.max((m.total / maxVal) * 100, 2);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-xs text-slate-400 font-bold">{m.total > 0 ? `${m.total.toFixed(0)}€` : ""}</div>
                      <div className="w-full relative" style={{ height: "160px" }}>
                        <div
                          className="absolute bottom-0 w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t transition-all"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <div className="text-xs text-slate-500 font-bold">{m.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Revenue by Method */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <h3 className="font-bold text-white mb-3">Ingresos por Método</h3>
                {(revenue.revenueByMethod || []).map((m: any, i: number) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-slate-700/50">
                    <span className="text-sm font-bold text-slate-300">{methodLabels[m.method] || m.method}</span>
                    <span className="text-sm font-bold text-amber-400">{(m._sum.amount || 0).toFixed(2)}€ ({m._count} pagos)</span>
                  </div>
                ))}
              </div>

              {/* Revenue by Plan */}
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <h3 className="font-bold text-white mb-3">Suscripciones por Plan</h3>
                {Object.entries(revenue.revenueByPlan || {}).map(([plan, data]: [string, any], i: number) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-slate-700/50">
                    <div>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${planColors[plan]} text-white mr-2`}>{plan}</span>
                      <span className="text-sm text-slate-300">{data.count} empresas</span>
                    </div>
                    <span className="text-sm font-bold text-blue-400">{data.mrr.toFixed(2)}€ MRR</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Overdue Payments */}
            {revenue.overduePayments && revenue.overduePayments.length > 0 && (
              <div className="bg-red-600/10 border border-red-600/20 rounded-xl p-5 mt-6">
                <h3 className="font-bold text-red-400 mb-3">Pagos Vencidos</h3>
                {revenue.overduePayments.map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-red-600/10">
                    <div>
                      <span className="text-sm font-bold text-white">{p.subscription?.company?.name || "—"}</span>
                      <span className="text-xs text-slate-400 ml-2">{p.invoiceNumber || "—"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-red-400">{p.amount.toFixed(2)}€</span>
                      <button onClick={() => handleUpdatePaymentStatus(p.id, "PAID")} className="bg-green-600/30 text-green-400 hover:bg-green-600/50 px-2 py-1 rounded text-xs font-bold transition">✓ Cobrar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== MODALS ==================== */}

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

      {/* Payment/Invoice Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowPaymentModal(false)}>
          <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-4">{editPayment ? "Editar factura" : "Nueva factura"}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Empresa</label>
                <select value={payForm.companyId} onChange={(e) => handleCompanyChange(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm">
                  <option value="">Seleccionar...</option>
                  {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Concepto</label>
                <input value={payForm.concept} onChange={(e) => setPayForm({ ...payForm, concept: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" placeholder="Suscripción mensual - Plan PRO" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Base imponible €</label>
                  <input type="number" step="0.01" value={payForm.subtotal} onChange={(e) => {
                    const subtotal = parseFloat(e.target.value) || 0;
                    const taxAmount = Math.round(subtotal * 0.21 * 100) / 100;
                    const total = Math.round((subtotal + taxAmount) * 100) / 100;
                    setPayForm({ ...payForm, subtotal, amount: total });
                  }} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Total (con 21% IVA) €</label>
                  <div className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-amber-400 text-sm font-bold">
                    {payForm.amount.toFixed(2)}€
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Método</label>
                  <select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm">
                    <option value="CARD">Tarjeta</option>
                    <option value="TRANSFER">Transferencia</option>
                    <option value="CASH">Efectivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-blue-400 uppercase mb-1">Fecha vencimiento</label>
                  <input type="date" value={payForm.dueDate} onChange={(e) => setPayForm({ ...payForm, dueDate: e.target.value })} className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={editPayment ? async () => {
                  await fetch(`/api/admin/payments/${editPayment.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...payForm, taxRate: 21.0, taxAmount: Math.round(payForm.subtotal * 0.21 * 100) / 100 }),
                  });
                  setShowPaymentModal(false);
                  setEditPayment(null);
                  fetchPayments();
                } : handleAddPayment} className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2 rounded-lg text-sm transition">
                  {editPayment ? "ACTUALIZAR" : "CREAR FACTURA"}
                </button>
                <button onClick={() => { setShowPaymentModal(false); setEditPayment(null); }} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg text-sm transition">CANCELAR</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
