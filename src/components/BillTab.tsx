"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

type BillingData = {
  subscription: any;
  payments: any[];
  usage: {
    professionals: number;
    sedes: number;
    maxProfessionals: number;
    maxSedes: number;
    proUsage: number;
    sedeUsage: number;
  };
  billing: {
    totalPaid: number;
    totalPending: number;
    nextBillingDate: string | null;
    isActive: boolean;
  };
};

export default function BillTab() {
  const { data: session } = useSession();
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  async function fetchBilling() {
    setLoading(true);
    const res = await fetch("/api/company/billing");
    if (res.ok) {
      const d = await res.json();
      setData(d);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchBilling();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <div className="text-red-400 p-6">Error cargando facturación</div>;

  const { subscription, payments, usage, billing } = data;

  const planLabels: Record<string, string> = { BASIC: "Básico", PRO: "Profesional", ENTERPRISE: "Empresa" };
  const billingLabels: Record<string, string> = { MONTHLY: "Mensual", QUARTERLY: "Trimestral", ANNUAL: "Anual" };
  const statusLabels: Record<string, string> = { ACTIVE: "Activo", TRIAL: "Prueba", PAST_DUE: "Vencido", CANCELLED: "Cancelado" };
  const statusColors: Record<string, string> = { ACTIVE: "text-green-400", TRIAL: "text-blue-400", PAST_DUE: "text-red-400", CANCELLED: "text-slate-500" };
  const payStatusColors: Record<string, string> = {
    PAID: "bg-green-600/30 text-green-400",
    PENDING: "bg-amber-600/30 text-amber-400",
    OVERDUE: "bg-red-600/30 text-red-400",
    FAILED: "bg-red-600/30 text-red-400",
    REFUNDED: "bg-slate-600/30 text-slate-400",
  };
  const methodLabels: Record<string, string> = { CARD: "Tarjeta", TRANSFER: "Transferencia", CASH: "Efectivo" };

  return (
    <div className="space-y-6">
      {/* Subscription & Plan Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Plan */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Mi Plan</h3>
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusColors[subscription?.status || "TRIAL"]} bg-slate-700`}>
              {statusLabels[subscription?.status || "TRIAL"]}
            </span>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl px-6 py-4 text-center">
              <div className="text-3xl font-black text-amber-400">{subscription?.price?.toFixed(2) || "0.00"}€</div>
              <div className="text-xs text-slate-400 font-bold mt-1">
                / {billingLabels[subscription?.billingMethod || "MONTHLY"]?.toLowerCase() || "mes"}
              </div>
            </div>
            <div>
              <div className="text-xl font-black text-white">{planLabels[subscription?.planName || "BASIC"]}</div>
              <div className="text-sm text-slate-400">
                Facturación {billingLabels[subscription?.billingMethod || "MONTHLY"]?.toLowerCase() || "mensual"}
              </div>
              {billing.nextBillingDate && (
                <div className="text-xs text-slate-500 mt-1">
                  Próxima factura: {new Date(billing.nextBillingDate).toLocaleDateString("es-ES")}
                </div>
              )}
            </div>
          </div>

          {/* Usage bars */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 font-bold">Profesionales</span>
                <span className="text-white font-bold">{usage.professionals} / {usage.maxProfessionals}</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usage.proUsage > 90 ? "bg-red-500" : usage.proUsage > 70 ? "bg-amber-500" : "bg-blue-500"}`}
                  style={{ width: `${Math.min(usage.proUsage, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400 font-bold">Sedes</span>
                <span className="text-white font-bold">{usage.sedes} / {usage.maxSedes}</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usage.sedeUsage > 90 ? "bg-red-500" : usage.sedeUsage > 70 ? "bg-amber-500" : "bg-green-500"}`}
                  style={{ width: `${Math.min(usage.sedeUsage, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Billing Summary */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Resumen de Facturación</h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-green-600/10 border border-green-600/20 rounded-xl p-4 text-center">
              <div className="text-xs text-green-400 font-bold uppercase">Total Pagado</div>
              <div className="text-2xl font-black text-green-400 mt-1">{billing.totalPaid.toFixed(2)}€</div>
            </div>
            <div className="bg-amber-600/10 border border-amber-600/20 rounded-xl p-4 text-center">
              <div className="text-xs text-amber-400 font-bold uppercase">Pendiente</div>
              <div className="text-2xl font-black text-amber-400 mt-1">{billing.totalPending.toFixed(2)}€</div>
            </div>
          </div>

          {/* Plan limits info */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-blue-400 uppercase">Límites del Plan</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between bg-slate-900/50 rounded-lg px-3 py-2">
                <span className="text-slate-400">Máx. Profesionales</span>
                <span className="text-white font-bold">{usage.maxProfessionals}</span>
              </div>
              <div className="flex justify-between bg-slate-900/50 rounded-lg px-3 py-2">
                <span className="text-slate-400">Máx. Sedes</span>
                <span className="text-white font-bold">{usage.maxSedes}</span>
              </div>
            </div>
            <div className="bg-slate-900/50 rounded-lg px-3 py-2 text-xs text-slate-500">
              Para ampliar los límites de tu plan, contacta con el administrador de MURAL Scheduling.
            </div>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl">
        <div className="px-6 py-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Historial de Facturas</h3>
          <div className="text-xs text-slate-400">{payments.length} facturas</div>
        </div>
        {payments.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No hay facturas disponibles</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-900">
                  <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Factura</th>
                  <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Concepto</th>
                  <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Base</th>
                  <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">IVA</th>
                  <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Vencimiento</th>
                  <th className="text-left px-4 py-3 text-xs font-extrabold text-blue-400 uppercase">Método</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr
                    key={p.id}
                    className="border-b border-slate-700/50 hover:bg-slate-700/20 cursor-pointer transition"
                    onClick={() => setSelectedPayment(selectedPayment?.id === p.id ? null : p)}
                  >
                    <td className="px-4 py-3 text-sm font-bold text-white">{p.invoiceNumber || "—"}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{p.concept || "Suscripción"}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{(p.subtotal || p.amount).toFixed(2)}€</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{p.taxAmount?.toFixed(2) || "—"}€</td>
                    <td className="px-4 py-3 text-sm font-bold text-amber-400">{p.amount.toFixed(2)}€</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${payStatusColors[p.status] || "bg-slate-600/30 text-slate-400"}`}>
                        {p.status === "PAID" ? "Pagado" : p.status === "PENDING" ? "Pendiente" : p.status === "OVERDUE" ? "Vencido" : p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {p.dueDate ? new Date(p.dueDate).toLocaleDateString("es-ES") : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{methodLabels[p.method] || p.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPayment(null)}>
          <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Detalle Factura</h3>
                <div className="text-sm text-slate-400">{selectedPayment.invoiceNumber || "Sin número"}</div>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${payStatusColors[selectedPayment.status] || "bg-slate-600/30 text-slate-400"}`}>
                {selectedPayment.status === "PAID" ? "Pagado" : selectedPayment.status === "PENDING" ? "Pendiente" : selectedPayment.status}
              </span>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-900/50 rounded-xl p-4">
                <div className="text-xs text-blue-400 font-bold uppercase mb-2">Concepto</div>
                <div className="text-white font-bold">{selectedPayment.concept || "Suscripción"}</div>
              </div>

              <div className="bg-slate-900/50 rounded-xl p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Base imponible</span>
                    <span className="text-white">{(selectedPayment.subtotal || selectedPayment.amount).toFixed(2)}€</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">IVA ({selectedPayment.taxRate || 21}%)</span>
                    <span className="text-white">{(selectedPayment.taxAmount || 0).toFixed(2)}€</span>
                  </div>
                  <div className="border-t border-slate-700 pt-2 flex justify-between text-sm font-bold">
                    <span className="text-white">Total</span>
                    <span className="text-amber-400">{selectedPayment.amount.toFixed(2)}€</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                  <div className="text-xs text-slate-500">Vencimiento</div>
                  <div className="text-white font-bold">
                    {selectedPayment.dueDate ? new Date(selectedPayment.dueDate).toLocaleDateString("es-ES") : "—"}
                  </div>
                </div>
                <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                  <div className="text-xs text-slate-500">Método de pago</div>
                  <div className="text-white font-bold">{methodLabels[selectedPayment.method] || selectedPayment.method}</div>
                </div>
                {selectedPayment.paidAt && (
                  <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                    <div className="text-xs text-slate-500">Fecha de pago</div>
                    <div className="text-white font-bold">{new Date(selectedPayment.paidAt).toLocaleDateString("es-ES")}</div>
                  </div>
                )}
                {selectedPayment.periodStart && (
                  <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                    <div className="text-xs text-slate-500">Período</div>
                    <div className="text-white font-bold">
                      {new Date(selectedPayment.periodStart).toLocaleDateString("es-ES")} - {selectedPayment.periodEnd ? new Date(selectedPayment.periodEnd).toLocaleDateString("es-ES") : "—"}
                    </div>
                  </div>
                )}
              </div>

              {selectedPayment.notes && (
                <div className="bg-slate-900/50 rounded-lg px-3 py-2 text-sm">
                  <div className="text-xs text-slate-500 mb-1">Notas</div>
                  <div className="text-slate-300">{selectedPayment.notes}</div>
                </div>
              )}
            </div>

            <div className="mt-6">
              <button
                onClick={() => setSelectedPayment(null)}
                className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg text-sm transition"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan comparison (upgrade info) */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Comparativa de Planes</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: "BASIC",
              label: "Básico",
              price: 29.99,
              maxPro: 5,
              maxSedes: 3,
              color: "border-slate-600",
              current: subscription?.planName === "BASIC",
            },
            {
              name: "PRO",
              label: "Profesional",
              price: 79.99,
              maxPro: 15,
              maxSedes: 10,
              color: "border-blue-500",
              current: subscription?.planName === "PRO",
            },
            {
              name: "ENTERPRISE",
              label: "Empresa",
              price: 199.99,
              maxPro: 999,
              maxSedes: 999,
              color: "border-amber-500",
              current: subscription?.planName === "ENTERPRISE",
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border-2 ${plan.current ? plan.color : "border-slate-700"} bg-slate-900/50 p-4 relative`}
            >
              {plan.current && (
                <div className="absolute -top-2.5 left-4 bg-amber-500 text-black text-xs font-black px-2 py-0.5 rounded">ACTUAL</div>
              )}
              <div className="text-lg font-black text-white">{plan.label}</div>
              <div className="text-3xl font-black text-amber-400 mt-2">{plan.price.toFixed(2)}€<span className="text-sm text-slate-400 font-normal">/mes</span></div>
              <div className="mt-3 space-y-1 text-sm text-slate-300">
                <div>Hasta {plan.maxPro === 999 ? "∞" : plan.maxPro} profesionales</div>
                <div>Hasta {plan.maxSedes === 999 ? "∞" : plan.maxSedes} sedes</div>
                <div>Calendario completo</div>
                <div>Soporte {plan.name === "BASIC" ? "email" : plan.name === "PRO" ? "prioritario" : "dedicado"}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-slate-500 text-center">
          Para cambiar de plan, contacta con el administrador de MURAL Scheduling.
        </div>
      </div>
    </div>
  );
}
