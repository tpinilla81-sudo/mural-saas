"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

type Toast = { id: number; message: string; type: "success" | "error" };
type BillTabKey = "entrada" | "registros" | "clientes" | "catalogo" | "facturas" | "config";

interface BillCliente {
  id: string;
  nombre: string;
  cif: string;
  dir: string;
  cp: string;
  ciudad: string;
  prov: string;
  mail: string;
  tel: string;
}

interface BillCatalogo {
  id: string;
  clienteId: string | null;
  c1: string;
  c2: string;
  coste: number;
  inc: number;
  final: number;
  cliente?: { id: string; nombre: string } | null;
}

interface BillRegistro {
  id: string;
  fecha: string;
  clienteId: string | null;
  cliente: string;
  c1: string;
  c2: string;
  cant: number;
  precioUnitario: number;
  obs: string;
  pasadoRegistro: boolean;
  facturado: boolean;
}

interface BillConfigData {
  id: string;
  companyFullName: string;
  companyAddress: string;
  companyCity: string;
  companyProvince: string;
  companyCif: string;
  logo: string;
  defaultIva: number;
}

interface BillFacturaSeq {
  id: string;
  seq: number;
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

const fmt = (n: number) => n.toFixed(2);
const today = () => new Date().toISOString().split("T")[0];
const fmtDate = (d: string) => {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return d;
  }
};

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════

export default function BillTab() {
  // ─── State ───
  const [tab, setTab] = useState<BillTabKey>("entrada");
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Data
  const [clientes, setClientes] = useState<BillCliente[]>([]);
  const [catalogo, setCatalogo] = useState<BillCatalogo[]>([]);
  const [registros, setRegistros] = useState<BillRegistro[]>([]);
  const [config, setConfig] = useState<BillConfigData | null>(null);
  const [facturaSeq, setFacturaSeq] = useState<BillFacturaSeq | null>(null);

  // Modals
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [editClienteId, setEditClienteId] = useState<string | null>(null);
  const [showCatalogoModal, setShowCatalogoModal] = useState(false);
  const [editCatalogoId, setEditCatalogoId] = useState<string | null>(null);
  const [showFacturaPreview, setShowFacturaPreview] = useState(false);

  // ─── Toast helper ───
  const addToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // ─── Data loading ───
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [clRes, catRes, regRes, cfgRes, seqRes] = await Promise.all([
        fetch("/api/company/bill/clientes"),
        fetch("/api/company/bill/catalogo"),
        fetch("/api/company/bill/registros?filter=all"),
        fetch("/api/company/bill/config"),
        fetch("/api/company/bill/factura-seq"),
      ]);
      if (clRes.ok) setClientes(await clRes.json());
      if (catRes.ok) setCatalogo(await catRes.json());
      if (regRes.ok) setRegistros(await regRes.json());
      if (cfgRes.ok) setConfig(await cfgRes.json());
      if (seqRes.ok) setFacturaSeq(await seqRes.json());
    } catch {
      addToast("Error al cargar datos", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── Registros filtered helpers ───
  const entradaRegistros = registros.filter(r => !r.pasadoRegistro);
  const pasadosRegistros = registros.filter(r => r.pasadoRegistro);

  // ═══════════════════════════════════════════
  // ENTRADA TAB
  // ═══════════════════════════════════════════

  const [entradaForm, setEntradaForm] = useState({
    fecha: today(),
    clienteId: "",
    c1: "",
    c2: "",
    cant: 1,
    precioUnitario: 0,
    obs: "",
  });

  // Autocomplete state
  const [c1Suggestions, setC1Suggestions] = useState<string[]>([]);
  const [c2Suggestions, setC2Suggestions] = useState<string[]>([]);
  const [showC1Drop, setShowC1Drop] = useState(false);
  const [showC2Drop, setShowC2Drop] = useState(false);
  const c1Ref = useRef<HTMLDivElement>(null);
  const c2Ref = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (c1Ref.current && !c1Ref.current.contains(e.target as Node)) setShowC1Drop(false);
      if (c2Ref.current && !c2Ref.current.contains(e.target as Node)) setShowC2Drop(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // C1 autocomplete
  useEffect(() => {
    if (!entradaForm.c1) { setC1Suggestions([]); return; }
    const uniqueC1s = [...new Set(catalogo.map(c => c.c1))];
    setC1Suggestions(uniqueC1s.filter(c => c.toLowerCase().includes(entradaForm.c1.toLowerCase())));
  }, [entradaForm.c1, catalogo]);

  // C2 autocomplete (filtered by selected C1)
  useEffect(() => {
    if (!entradaForm.c2) { setC2Suggestions([]); return; }
    const filtered = entradaForm.c1
      ? catalogo.filter(c => c.c1 === entradaForm.c1)
      : catalogo;
    const items = entradaForm.c1
      ? filtered.filter(c => c.c2.toLowerCase().includes(entradaForm.c2.toLowerCase()))
      : filtered.filter(c => c.c2.toLowerCase().includes(entradaForm.c2.toLowerCase()));
    setC2Suggestions([...new Set(items.map(c => c.c2))]);
  }, [entradaForm.c2, entradaForm.c1, catalogo]);

  // Auto-fill price when C1+C2 match a catalog item
  useEffect(() => {
    if (!entradaForm.c1 || !entradaForm.c2) return;
    const match = catalogo.find(c =>
      c.c1 === entradaForm.c1 && c.c2 === entradaForm.c2 &&
      (!c.clienteId || c.clienteId === entradaForm.clienteId)
    );
    if (match) {
      setEntradaForm(f => ({ ...f, precioUnitario: match.final }));
    }
  }, [entradaForm.c1, entradaForm.c2, entradaForm.clienteId, catalogo]);

  async function addEntrada() {
    const clienteObj = clientes.find(c => c.id === entradaForm.clienteId);
    try {
      const res = await fetch("/api/company/bill/registros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...entradaForm,
          cliente: clienteObj?.nombre || "",
        }),
      });
      if (res.ok) {
        const newReg = await res.json();
        setRegistros(prev => [newReg, ...prev]);
        setEntradaForm({ fecha: today(), clienteId: "", c1: "", c2: "", cant: 1, precioUnitario: 0, obs: "" });
        addToast("Entrada añadida");
      } else {
        addToast("Error al añadir entrada", "error");
      }
    } catch {
      addToast("Error de conexión", "error");
    }
  }

  async function transferAllEntradas() {
    if (entradaRegistros.length === 0) return;
    if (!confirm(`¿Pasar ${entradaRegistros.length} entrada(s) a Registros?`)) return;
    try {
      const res = await fetch("/api/company/bill/registros/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: entradaRegistros.map(r => r.id) }),
      });
      if (res.ok) {
        const data = await res.json();
        setRegistros(prev => prev.map(r =>
          !r.pasadoRegistro ? { ...r, pasadoRegistro: true } : r
        ));
        addToast(`${data.transferred} entrada(s) transferida(s)`);
      } else {
        addToast("Error al transferir", "error");
      }
    } catch {
      addToast("Error de conexión", "error");
    }
  }

  async function deleteRegistro(id: string) {
    if (!confirm("¿Eliminar este registro?")) return;
    try {
      const res = await fetch(`/api/company/bill/registros/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRegistros(prev => prev.filter(r => r.id !== id));
        addToast("Registro eliminado");
      } else {
        addToast("Error al eliminar", "error");
      }
    } catch {
      addToast("Error de conexión", "error");
    }
  }

  // ═══════════════════════════════════════════
  // REGISTROS TAB
  // ═══════════════════════════════════════════

  const [regFilter, setRegFilter] = useState({ dateFrom: "", dateTo: "", clienteId: "", search: "" });
  const [editingRegId, setEditingRegId] = useState<string | null>(null);
  const [editRegForm, setEditRegForm] = useState<Partial<BillRegistro>>({});

  const filteredRegistros = pasadosRegistros.filter(r => {
    if (regFilter.dateFrom && r.fecha < regFilter.dateFrom) return false;
    if (regFilter.dateTo && r.fecha > regFilter.dateTo) return false;
    if (regFilter.clienteId && r.clienteId !== regFilter.clienteId) return false;
    if (regFilter.search) {
      const s = regFilter.search.toLowerCase();
      if (!r.cliente.toLowerCase().includes(s) && !r.c1.toLowerCase().includes(s) &&
          !r.c2.toLowerCase().includes(s) && !r.obs.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const regTotal = filteredRegistros.reduce((sum, r) => sum + r.cant * r.precioUnitario, 0);

  function startEditReg(r: BillRegistro) {
    setEditingRegId(r.id);
    setEditRegForm({ ...r });
  }

  async function saveEditReg() {
    if (!editingRegId) return;
    try {
      const res = await fetch(`/api/company/bill/registros/${editingRegId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editRegForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setRegistros(prev => prev.map(r => r.id === editingRegId ? updated : r));
        setEditingRegId(null);
        addToast("Registro actualizado");
      } else {
        addToast("Error al actualizar", "error");
      }
    } catch {
      addToast("Error de conexión", "error");
    }
  }

  // ═══════════════════════════════════════════
  // CLIENTES TAB
  // ═══════════════════════════════════════════

  const emptyClienteForm = { nombre: "", cif: "", dir: "", cp: "", ciudad: "", prov: "", mail: "", tel: "" };
  const [clienteForm, setClienteForm] = useState(emptyClienteForm);

  function openNewCliente() {
    setEditClienteId(null);
    setClienteForm(emptyClienteForm);
    setShowClienteModal(true);
  }

  function openEditCliente(c: BillCliente) {
    setEditClienteId(c.id);
    setClienteForm({ nombre: c.nombre, cif: c.cif, dir: c.dir, cp: c.cp, ciudad: c.ciudad, prov: c.prov, mail: c.mail, tel: c.tel });
    setShowClienteModal(true);
  }

  async function saveCliente() {
    if (!clienteForm.nombre) { addToast("Nombre es obligatorio", "error"); return; }
    try {
      if (editClienteId) {
        const res = await fetch(`/api/company/bill/clientes/${editClienteId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clienteForm),
        });
        if (res.ok) {
          const updated = await res.json();
          setClientes(prev => prev.map(c => c.id === editClienteId ? updated : c));
          addToast("Cliente actualizado");
        } else { addToast("Error al actualizar", "error"); }
      } else {
        const res = await fetch("/api/company/bill/clientes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(clienteForm),
        });
        if (res.ok) {
          const created = await res.json();
          setClientes(prev => [...prev, created]);
          addToast("Cliente creado");
        } else { addToast("Error al crear", "error"); }
      }
      setShowClienteModal(false);
    } catch {
      addToast("Error de conexión", "error");
    }
  }

  async function deleteCliente(id: string) {
    if (!confirm("¿Eliminar este cliente?")) return;
    try {
      const res = await fetch(`/api/company/bill/clientes/${id}`, { method: "DELETE" });
      if (res.ok) {
        setClientes(prev => prev.filter(c => c.id !== id));
        addToast("Cliente eliminado");
      } else { addToast("Error al eliminar", "error"); }
    } catch {
      addToast("Error de conexión", "error");
    }
  }

  // ═══════════════════════════════════════════
  // CATÁLOGO TAB
  // ═══════════════════════════════════════════

  const emptyCatalogoForm = { clienteId: "", c1: "", c2: "", coste: 0, inc: 0 };
  const [catalogoForm, setCatalogoForm] = useState(emptyCatalogoForm);

  function openNewCatalogo() {
    setEditCatalogoId(null);
    setCatalogoForm(emptyCatalogoForm);
    setShowCatalogoModal(true);
  }

  function openEditCatalogo(c: BillCatalogo) {
    setEditCatalogoId(c.id);
    setCatalogoForm({ clienteId: c.clienteId || "", c1: c.c1, c2: c.c2, coste: c.coste, inc: c.inc });
    setShowCatalogoModal(true);
  }

  async function saveCatalogo() {
    if (!catalogoForm.c1 || !catalogoForm.c2) { addToast("C1 y C2 son obligatorios", "error"); return; }
    try {
      if (editCatalogoId) {
        const res = await fetch(`/api/company/bill/catalogo/${editCatalogoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(catalogoForm),
        });
        if (res.ok) {
          const updated = await res.json();
          setCatalogo(prev => prev.map(c => c.id === editCatalogoId ? updated : c));
          addToast("Catálogo actualizado");
        } else { addToast("Error al actualizar", "error"); }
      } else {
        const res = await fetch("/api/company/bill/catalogo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(catalogoForm),
        });
        if (res.ok) {
          const created = await res.json();
          setCatalogo(prev => [...prev, created]);
          addToast("Ítem de catálogo creado");
        } else { addToast("Error al crear", "error"); }
      }
      setShowCatalogoModal(false);
    } catch {
      addToast("Error de conexión", "error");
    }
  }

  async function deleteCatalogoItem(id: string) {
    if (!confirm("¿Eliminar este ítem?")) return;
    try {
      const res = await fetch(`/api/company/bill/catalogo/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCatalogo(prev => prev.filter(c => c.id !== id));
        addToast("Ítem eliminado");
      } else { addToast("Error al eliminar", "error"); }
    } catch {
      addToast("Error de conexión", "error");
    }
  }

  // ═══════════════════════════════════════════
  // FACTURAS TAB
  // ═══════════════════════════════════════════

  const [selectedFacturaIds, setSelectedFacturaIds] = useState<Set<string>>(new Set());
  const [facturaGroupBy, setFacturaGroupBy] = useState<"day" | "month">("day");
  const [facturaClienteFilter, setFacturaClienteFilter] = useState("");

  const facturableRegistros = pasadosRegistros.filter(r => !r.facturado && (!facturaClienteFilter || r.clienteId === facturaClienteFilter));

  // Group registros
  const groupedFacturas: Record<string, BillRegistro[]> = {};
  facturableRegistros.forEach(r => {
    const key = facturaGroupBy === "day" ? r.fecha : r.fecha.substring(0, 7);
    if (!groupedFacturas[key]) groupedFacturas[key] = [];
    groupedFacturas[key].push(r);
  });

  const sortedGroupKeys = Object.keys(groupedFacturas).sort().reverse();

  function toggleFacturaSelect(id: string) {
    setSelectedFacturaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleGroupSelect(key: string) {
    const groupIds = groupedFacturas[key].map(r => r.id);
    const allSelected = groupIds.every(id => selectedFacturaIds.has(id));
    setSelectedFacturaIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        groupIds.forEach(id => next.delete(id));
      } else {
        groupIds.forEach(id => next.add(id));
      }
      return next;
    });
  }

  function selectAllFacturas() {
    setSelectedFacturaIds(new Set(facturableRegistros.map(r => r.id)));
  }

  function clearFacturaSelection() {
    setSelectedFacturaIds(new Set());
  }

  const selectedRegistros = facturableRegistros.filter(r => selectedFacturaIds.has(r.id));
  const facturaBase = selectedRegistros.reduce((sum, r) => sum + r.cant * r.precioUnitario, 0);
  const facturaIvaRate = config?.defaultIva ?? 21;
  const facturaIva = facturaBase * (facturaIvaRate / 100);
  const facturaTotal = facturaBase + facturaIva;

  function generateInvoiceNumber() {
    const seq = facturaSeq?.seq || 1;
    const year = new Date().getFullYear();
    return `${String(seq).padStart(4, "0")}/${year}`;
  }

  async function generateFactura() {
    if (selectedRegistros.length === 0) { addToast("Selecciona al menos un registro", "error"); return; }

    const invoiceNumber = generateInvoiceNumber();
    const clienteId = selectedRegistros[0]?.clienteId;
    const clienteObj = clientes.find(c => c.id === clienteId);

    // Build print-friendly HTML invoice
    const items = selectedRegistros.map(r => ({
      fecha: r.fecha,
      c1: r.c1,
      c2: r.c2,
      cant: r.cant,
      precio: r.precioUnitario,
      total: r.cant * r.precioUnitario,
      obs: r.obs,
    }));

    const cfg = config || {
      companyFullName: "",
      companyAddress: "",
      companyCity: "",
      companyProvince: "",
      companyCif: "",
      logo: "",
    };

    const printHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Factura ${invoiceNumber}</title>
<style>
  @page { size: A4; margin: 20mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 11pt; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #2E5D3A; }
  .company-info h1 { font-size: 18pt; color: #2E5D3A; margin-bottom: 4px; }
  .company-info p { font-size: 9pt; color: #555; line-height: 1.4; }
  .invoice-box { background: #f8f9fa; border: 1px solid #ddd; border-radius: 8px; padding: 16px; min-width: 220px; }
  .invoice-box h2 { font-size: 13pt; color: #2E5D3A; margin-bottom: 8px; }
  .invoice-box p { font-size: 9pt; color: #333; line-height: 1.5; }
  .parties { display: flex; gap: 30px; margin-bottom: 24px; }
  .party { flex: 1; }
  .party h3 { font-size: 10pt; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
  .party p { font-size: 9.5pt; line-height: 1.6; }
  .party .name { font-weight: bold; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  thead th { background: #2E5D3A; color: white; padding: 8px 10px; text-align: left; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.3px; }
  thead th:last-child, thead th:nth-child(n+3) { text-align: right; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 9.5pt; }
  tbody td:last-child, tbody td:nth-child(n+3) { text-align: right; }
  tbody tr:nth-child(even) { background: #fafafa; }
  tfoot td { padding: 6px 10px; font-weight: bold; border-top: 1px solid #ddd; }
  tfoot .total-row { background: #2E5D3A; color: white; font-size: 12pt; }
  .totals { width: 280px; margin-left: auto; margin-bottom: 30px; }
  .totals table { margin: 0; }
  .footnotes { margin-top: 40px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 8pt; color: #888; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="header">
    <div class="company-info">
      ${cfg.logo ? `<img src="${cfg.logo}" style="max-height:60px; margin-bottom:8px;" alt="Logo" />` : ""}
      <h1>${cfg.companyFullName || "Empresa"}</h1>
      <p>${cfg.companyAddress}${cfg.companyCity ? ", " + cfg.companyCity : ""}${cfg.companyProvince ? " (" + cfg.companyProvince + ")" : ""}</p>
      <p>${cfg.companyCif ? "CIF: " + cfg.companyCif : ""}</p>
    </div>
    <div class="invoice-box">
      <h2>FACTURA</h2>
      <p><strong>Nº:</strong> ${invoiceNumber}</p>
      <p><strong>Fecha:</strong> ${new Date().toLocaleDateString("es-ES")}</p>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Datos del Emisor</h3>
      <p class="name">${cfg.companyFullName || "Empresa"}</p>
      <p>${cfg.companyAddress}</p>
      <p>${cfg.companyCity}${cfg.companyProvince ? " (" + cfg.companyProvince + ")" : ""}</p>
      <p>${cfg.companyCif ? "CIF: " + cfg.companyCif : ""}</p>
    </div>
    <div class="party">
      <h3>Datos del Cliente</h3>
      <p class="name">${clienteObj?.nombre || "—"}</p>
      <p>${clienteObj?.dir || ""}</p>
      <p>${clienteObj?.cp ? clienteObj.cp + " " : ""}${clienteObj?.ciudad || ""}${clienteObj?.prov ? " (" + clienteObj.prov + ")" : ""}</p>
      <p>${clienteObj?.cif ? "CIF: " + clienteObj.cif : ""}</p>
      <p>${clienteObj?.mail ? clienteObj.mail : ""}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Concepto</th>
        <th>Obs</th>
        <th>Cant.</th>
        <th>Precio</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map(it => `
      <tr>
        <td>${fmtDate(it.fecha)}</td>
        <td>${it.c1}${it.c2 ? " — " + it.c2 : ""}</td>
        <td>${it.obs || ""}</td>
        <td>${it.cant}</td>
        <td>${fmt(it.precio)}€</td>
        <td>${fmt(it.total)}€</td>
      </tr>`).join("")}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Base Imponible</td><td style="text-align:right">${fmt(facturaBase)}€</td></tr>
      <tr><td>IVA (${facturaIvaRate}%)</td><td style="text-align:right">${fmt(facturaIva)}€</td></tr>
      <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${fmt(facturaTotal)}€</td></tr>
    </table>
  </div>

  <div class="footnotes">
    <p>Factura generada por BILL by Método — MURAL Scheduling</p>
  </div>
</body>
</html>`;

    // Open print window
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }

    // Mark as facturado
    try {
      const res = await fetch("/api/company/bill/registros/mark-facturado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedFacturaIds) }),
      });
      if (res.ok) {
        setRegistros(prev => prev.map(r =>
          selectedFacturaIds.has(r.id) ? { ...r, facturado: true } : r
        ));
        // Increment sequence
        const newSeq = (facturaSeq?.seq || 1) + 1;
        await fetch("/api/company/bill/factura-seq", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seq: newSeq }),
        });
        setFacturaSeq(prev => prev ? { ...prev, seq: newSeq } : null);
        setSelectedFacturaIds(new Set());
        addToast(`Factura ${invoiceNumber} generada`);
      } else {
        addToast("Error al marcar como facturado", "error");
      }
    } catch {
      addToast("Error de conexión", "error");
    }
  }

  // ═══════════════════════════════════════════
  // CONFIGURACIÓN TAB
  // ═══════════════════════════════════════════

  const [configForm, setConfigForm] = useState({
    companyFullName: "",
    companyAddress: "",
    companyCity: "",
    companyProvince: "",
    companyCif: "",
    logo: "",
    defaultIva: 21,
  });
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    if (config) {
      setConfigForm({
        companyFullName: config.companyFullName || "",
        companyAddress: config.companyAddress || "",
        companyCity: config.companyCity || "",
        companyProvince: config.companyProvince || "",
        companyCif: config.companyCif || "",
        logo: config.logo || "",
        defaultIva: config.defaultIva ?? 21,
      });
    }
  }, [config]);

  async function saveConfig() {
    setSavingConfig(true);
    try {
      const res = await fetch("/api/company/bill/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        addToast("Configuración guardada");
      } else {
        addToast("Error al guardar", "error");
      }
    } catch {
      addToast("Error de conexión", "error");
    } finally {
      setSavingConfig(false);
    }
  }

  // ═══════════════════════════════════════════
  // SHARED STYLES
  // ═══════════════════════════════════════════

  const inputCls = "w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:border-[#2E5D3A] focus:outline-none";
  const labelCls = "block text-xs font-extrabold text-blue-400 uppercase mb-1";
  const cardCls = "bg-slate-800/50 border border-slate-700 rounded-xl p-3 sm:p-4";
  const btnPrimary = "bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white font-bold px-3 py-1.5 rounded-lg text-xs sm:text-sm transition";
  const btnSecondary = "bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs sm:text-sm transition";
  const btnDanger = "bg-red-600/20 hover:bg-red-600/30 text-red-400 font-bold px-2 py-1 rounded text-xs transition";

  // ═══════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-[#2E5D3A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  const tabs: { key: BillTabKey; label: string }[] = [
    { key: "entrada", label: "ENTRADA" },
    { key: "registros", label: "REGISTROS" },
    { key: "clientes", label: "CLIENTES" },
    { key: "catalogo", label: "CATÁLOGO" },
    { key: "facturas", label: "FACTURAS" },
    { key: "config", label: "CONFIG" },
  ];

  return (
    <div className="space-y-3 relative">
      {/* ═══════ Toasts ═══════ */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded-lg text-sm font-bold shadow-lg ${
            t.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}>
            {t.message}
          </div>
        ))}
      </div>

      {/* ═══════ Tab buttons ═══════ */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition whitespace-nowrap ${
              tab === t.key ? "bg-[#6BBE7A] text-black" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}>
            {t.label}
            {t.key === "entrada" && entradaRegistros.length > 0 && (
              <span className="ml-1.5 bg-amber-500 text-black text-[10px] font-black px-1.5 py-0.5 rounded-full">{entradaRegistros.length}</span>
            )}
            {t.key === "facturas" && facturableRegistros.length > 0 && (
              <span className="ml-1.5 bg-blue-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{facturableRegistros.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════
          ENTRADA TAB
          ═══════════════════════════════════════════ */}
      {tab === "entrada" && (
        <div className="space-y-3">
          {/* Entry form */}
          <div className={cardCls}>
            <h3 className="font-bold text-white mb-3 text-sm">Nueva Entrada</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Fecha</label>
                <input type="date" value={entradaForm.fecha}
                  onChange={e => setEntradaForm(f => ({ ...f, fecha: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cliente</label>
                <select value={entradaForm.clienteId}
                  onChange={e => setEntradaForm(f => ({ ...f, clienteId: e.target.value }))}
                  className={inputCls}>
                  <option value="">— Seleccionar —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              {/* C1 with autocomplete */}
              <div className="relative" ref={c1Ref}>
                <label className={labelCls}>C1 (Grupo)</label>
                <input value={entradaForm.c1}
                  onChange={e => { setEntradaForm(f => ({ ...f, c1: e.target.value, c2: "", precioUnitario: 0 })); setShowC1Drop(true); }}
                  onFocus={() => setShowC1Drop(true)}
                  className={inputCls}
                  placeholder="Grupo concepto..." />
                {showC1Drop && c1Suggestions.length > 0 && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                    {c1Suggestions.map(s => (
                      <button key={s} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700 transition"
                        onClick={() => { setEntradaForm(f => ({ ...f, c1: s, c2: "", precioUnitario: 0 })); setShowC1Drop(false); }}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* C2 with autocomplete */}
              <div className="relative" ref={c2Ref}>
                <label className={labelCls}>C2 (Servicio)</label>
                <input value={entradaForm.c2}
                  onChange={e => { setEntradaForm(f => ({ ...f, c2: e.target.value })); setShowC2Drop(true); }}
                  onFocus={() => setShowC2Drop(true)}
                  className={inputCls}
                  placeholder="Servicio..." />
                {showC2Drop && c2Suggestions.length > 0 && (
                  <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                    {c2Suggestions.map(s => (
                      <button key={s} className="w-full text-left px-3 py-2 text-sm text-white hover:bg-slate-700 transition"
                        onClick={() => { setEntradaForm(f => ({ ...f, c2: s })); setShowC2Drop(false); }}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className={labelCls}>Cantidad</label>
                <input type="number" min="1" value={entradaForm.cant}
                  onChange={e => setEntradaForm(f => ({ ...f, cant: parseInt(e.target.value) || 1 }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Precio Unitario</label>
                <input type="number" step="0.01" value={entradaForm.precioUnitario}
                  onChange={e => setEntradaForm(f => ({ ...f, precioUnitario: parseFloat(e.target.value) || 0 }))}
                  className={inputCls} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={labelCls}>Observaciones</label>
                <input value={entradaForm.obs}
                  onChange={e => setEntradaForm(f => ({ ...f, obs: e.target.value }))}
                  className={inputCls} placeholder="Observaciones..." />
              </div>
            </div>
            <div className="flex justify-between items-center mt-3">
              <div className="text-sm text-slate-400">
                Total: <span className="text-amber-400 font-bold">{fmt(entradaForm.cant * entradaForm.precioUnitario)}€</span>
              </div>
              <button onClick={addEntrada} className={btnPrimary}>+ Añadir Entrada</button>
            </div>
          </div>

          {/* Un-transferred entries */}
          <div className={cardCls}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-white text-sm">
                Entradas Pendientes
                <span className="ml-2 text-amber-400 font-bold">({entradaRegistros.length})</span>
              </h3>
              {entradaRegistros.length > 0 && (
                <button onClick={transferAllEntradas}
                  className="bg-amber-600 hover:bg-amber-500 text-black font-bold px-3 py-1.5 rounded-lg text-xs transition">
                  Pasar a Registros →
                </button>
              )}
            </div>

            {entradaRegistros.length === 0 ? (
              <div className="text-center text-slate-500 py-6 text-sm">No hay entradas pendientes</div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="sm:hidden space-y-2 max-h-96 overflow-y-auto">
                  {entradaRegistros.map(r => (
                    <div key={r.id} className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 space-y-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs text-slate-400">{fmtDate(r.fecha)}</div>
                          <div className="text-sm font-bold text-white">{r.c1}{r.c2 ? " — " + r.c2 : ""}</div>
                          <div className="text-xs text-slate-400">{r.cliente || "Sin cliente"}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-amber-400 font-bold text-sm">{fmt(r.cant * r.precioUnitario)}€</div>
                          <div className="text-[10px] text-slate-500">{r.cant} × {fmt(r.precioUnitario)}€</div>
                        </div>
                      </div>
                      {r.obs && <div className="text-xs text-slate-500 italic">{r.obs}</div>}
                      <div className="flex justify-end">
                        <button onClick={() => deleteRegistro(r.id)} className={btnDanger}>Eliminar</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto max-h-96">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-slate-900 z-10">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Fecha</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Cliente</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">C1</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">C2</th>
                        <th className="text-right px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Cant</th>
                        <th className="text-right px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Precio</th>
                        <th className="text-right px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Total</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Obs</th>
                        <th className="text-center px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Acc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entradaRegistros.map(r => (
                        <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                          <td className="px-3 py-2 text-sm text-slate-300">{fmtDate(r.fecha)}</td>
                          <td className="px-3 py-2 text-sm text-white font-medium">{r.cliente || "—"}</td>
                          <td className="px-3 py-2 text-sm text-white">{r.c1}</td>
                          <td className="px-3 py-2 text-sm text-slate-300">{r.c2}</td>
                          <td className="px-3 py-2 text-sm text-white text-right">{r.cant}</td>
                          <td className="px-3 py-2 text-sm text-slate-300 text-right">{fmt(r.precioUnitario)}€</td>
                          <td className="px-3 py-2 text-sm text-amber-400 font-bold text-right">{fmt(r.cant * r.precioUnitario)}€</td>
                          <td className="px-3 py-2 text-xs text-slate-500 max-w-[120px] truncate">{r.obs}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => deleteRegistro(r.id)} className={btnDanger}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          REGISTROS TAB
          ═══════════════════════════════════════════ */}
      {tab === "registros" && (
        <div className="space-y-3">
          {/* Filters */}
          <div className={cardCls}>
            <h3 className="font-bold text-white mb-3 text-sm">Filtros</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className={labelCls}>Desde</label>
                <input type="date" value={regFilter.dateFrom}
                  onChange={e => setRegFilter(f => ({ ...f, dateFrom: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Hasta</label>
                <input type="date" value={regFilter.dateTo}
                  onChange={e => setRegFilter(f => ({ ...f, dateTo: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Cliente</label>
                <select value={regFilter.clienteId}
                  onChange={e => setRegFilter(f => ({ ...f, clienteId: e.target.value }))}
                  className={inputCls}>
                  <option value="">Todos</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Buscar</label>
                <input value={regFilter.search}
                  onChange={e => setRegFilter(f => ({ ...f, search: e.target.value }))}
                  className={inputCls} placeholder="Buscar..." />
              </div>
            </div>
          </div>

          {/* Registros table/cards */}
          <div className={cardCls}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-white text-sm">
                Registros
                <span className="ml-2 text-slate-400 font-normal">({filteredRegistros.length})</span>
              </h3>
              <div className="text-sm">
                Total: <span className="text-amber-400 font-bold">{fmt(regTotal)}€</span>
              </div>
            </div>

            {filteredRegistros.length === 0 ? (
              <div className="text-center text-slate-500 py-6 text-sm">No hay registros</div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="sm:hidden space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredRegistros.map(r => (
                    <div key={r.id} className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-3 space-y-2">
                      {editingRegId === r.id ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-blue-400 font-bold mb-0.5">Fecha</label>
                              <input type="date" value={editRegForm.fecha}
                                onChange={e => setEditRegForm(f => ({ ...f, fecha: e.target.value }))}
                                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-blue-400 font-bold mb-0.5">Cliente</label>
                              <select value={editRegForm.clienteId || ""}
                                onChange={e => {
                                  const cid = e.target.value;
                                  const cname = clientes.find(c => c.id === cid)?.nombre || "";
                                  setEditRegForm(f => ({ ...f, clienteId: cid, cliente: cname }));
                                }}
                                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs">
                                <option value="">—</option>
                                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-blue-400 font-bold mb-0.5">C1</label>
                              <input value={editRegForm.c1 || ""}
                                onChange={e => setEditRegForm(f => ({ ...f, c1: e.target.value }))}
                                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-blue-400 font-bold mb-0.5">C2</label>
                              <input value={editRegForm.c2 || ""}
                                onChange={e => setEditRegForm(f => ({ ...f, c2: e.target.value }))}
                                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-blue-400 font-bold mb-0.5">Cant</label>
                              <input type="number" value={editRegForm.cant || 1}
                                onChange={e => setEditRegForm(f => ({ ...f, cant: parseInt(e.target.value) || 1 }))}
                                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs" />
                            </div>
                            <div>
                              <label className="block text-[10px] text-blue-400 font-bold mb-0.5">Precio</label>
                              <input type="number" step="0.01" value={editRegForm.precioUnitario || 0}
                                onChange={e => setEditRegForm(f => ({ ...f, precioUnitario: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] text-blue-400 font-bold mb-0.5">Obs</label>
                            <input value={editRegForm.obs || ""}
                              onChange={e => setEditRegForm(f => ({ ...f, obs: e.target.value }))}
                              className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-xs" />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={saveEditReg} className="flex-1 bg-[#2E5D3A] text-white text-xs font-bold py-1.5 rounded">Guardar</button>
                            <button onClick={() => setEditingRegId(null)} className="flex-1 bg-slate-700 text-white text-xs font-bold py-1.5 rounded">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-xs text-slate-400">{fmtDate(r.fecha)}</div>
                              <div className="text-sm font-bold text-white">{r.c1}{r.c2 ? " — " + r.c2 : ""}</div>
                              <div className="text-xs text-slate-400">{r.cliente || "Sin cliente"}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-amber-400 font-bold text-sm">{fmt(r.cant * r.precioUnitario)}€</div>
                              <div className="text-[10px] text-slate-500">{r.cant} × {fmt(r.precioUnitario)}€</div>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {r.obs && <span className="text-xs text-slate-500 italic truncate max-w-[150px]">{r.obs}</span>}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                r.facturado ? "bg-green-600/20 text-green-400" : "bg-slate-600/30 text-slate-400"
                              }`}>
                                {r.facturado ? "Facturado" : "Pendiente"}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => startEditReg(r)} className="px-2 py-1 rounded text-xs font-bold bg-blue-600/20 text-blue-400">✎</button>
                              <button onClick={() => deleteRegistro(r.id)} className={btnDanger}>✕</button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto max-h-[500px]">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-slate-900 z-10">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Fecha</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Cliente</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">C1</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">C2</th>
                        <th className="text-right px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Cant</th>
                        <th className="text-right px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Precio</th>
                        <th className="text-right px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Total</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Obs</th>
                        <th className="text-center px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Fact</th>
                        <th className="text-center px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Acc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRegistros.map(r => (
                        editingRegId === r.id ? (
                          <tr key={r.id} className="border-b border-amber-600/30 bg-slate-800">
                            <td className="px-2 py-1"><input type="date" value={editRegForm.fecha} onChange={e => setEditRegForm(f => ({ ...f, fecha: e.target.value }))} className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-xs" /></td>
                            <td className="px-2 py-1">
                              <select value={editRegForm.clienteId || ""} onChange={e => { const cid = e.target.value; const cname = clientes.find(c => c.id === cid)?.nombre || ""; setEditRegForm(f => ({ ...f, clienteId: cid, cliente: cname })); }} className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-xs">
                                <option value="">—</option>
                                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                              </select>
                            </td>
                            <td className="px-2 py-1"><input value={editRegForm.c1 || ""} onChange={e => setEditRegForm(f => ({ ...f, c1: e.target.value }))} className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-xs" /></td>
                            <td className="px-2 py-1"><input value={editRegForm.c2 || ""} onChange={e => setEditRegForm(f => ({ ...f, c2: e.target.value }))} className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-xs" /></td>
                            <td className="px-2 py-1"><input type="number" value={editRegForm.cant || 1} onChange={e => setEditRegForm(f => ({ ...f, cant: parseInt(e.target.value) || 1 }))} className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-xs text-right" /></td>
                            <td className="px-2 py-1"><input type="number" step="0.01" value={editRegForm.precioUnitario || 0} onChange={e => setEditRegForm(f => ({ ...f, precioUnitario: parseFloat(e.target.value) || 0 }))} className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-xs text-right" /></td>
                            <td className="px-3 py-2 text-amber-400 font-bold text-sm text-right">{fmt((editRegForm.cant || 1) * (editRegForm.precioUnitario || 0))}€</td>
                            <td className="px-2 py-1"><input value={editRegForm.obs || ""} onChange={e => setEditRegForm(f => ({ ...f, obs: e.target.value }))} className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-white text-xs" /></td>
                            <td className="px-3 py-2"></td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex gap-1 justify-center">
                                <button onClick={saveEditReg} className="px-2 py-1 rounded text-xs font-bold bg-[#2E5D3A] text-white">✓</button>
                                <button onClick={() => setEditingRegId(null)} className="px-2 py-1 rounded text-xs font-bold bg-slate-700 text-white">✕</button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                            <td className="px-3 py-2 text-sm text-slate-300">{fmtDate(r.fecha)}</td>
                            <td className="px-3 py-2 text-sm text-white font-medium">{r.cliente || "—"}</td>
                            <td className="px-3 py-2 text-sm text-white">{r.c1}</td>
                            <td className="px-3 py-2 text-sm text-slate-300">{r.c2}</td>
                            <td className="px-3 py-2 text-sm text-white text-right">{r.cant}</td>
                            <td className="px-3 py-2 text-sm text-slate-300 text-right">{fmt(r.precioUnitario)}€</td>
                            <td className="px-3 py-2 text-sm text-amber-400 font-bold text-right">{fmt(r.cant * r.precioUnitario)}€</td>
                            <td className="px-3 py-2 text-xs text-slate-500 max-w-[120px] truncate">{r.obs}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                r.facturado ? "bg-green-600/20 text-green-400" : "bg-slate-600/30 text-slate-400"
                              }`}>
                                {r.facturado ? "Sí" : "No"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex gap-1 justify-center">
                                <button onClick={() => startEditReg(r)} className="px-2 py-1 rounded text-xs font-bold bg-blue-600/20 text-blue-400">✎</button>
                                <button onClick={() => deleteRegistro(r.id)} className={btnDanger}>✕</button>
                              </div>
                            </td>
                          </tr>
                        )
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-slate-900">
                      <tr className="border-t-2 border-[#2E5D3A]">
                        <td colSpan={6} className="px-3 py-2 text-sm font-bold text-white text-right">TOTAL</td>
                        <td className="px-3 py-2 text-sm font-black text-amber-400 text-right">{fmt(regTotal)}€</td>
                        <td colSpan={3}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          CLIENTES TAB
          ═══════════════════════════════════════════ */}
      {tab === "clientes" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white text-sm">Clientes ({clientes.length})</h3>
            <button onClick={openNewCliente} className={btnPrimary}>+ Nuevo Cliente</button>
          </div>

          {clientes.length === 0 ? (
            <div className={cardCls}>
              <div className="text-center text-slate-500 py-8 text-sm">No hay clientes</div>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-2 max-h-[600px] overflow-y-auto">
                {clientes.map(c => (
                  <div key={c.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-bold text-white">{c.nombre}</div>
                        {c.cif && <div className="text-xs text-slate-400">CIF: {c.cif}</div>}
                        {c.dir && <div className="text-xs text-slate-400">{c.dir}</div>}
                        {(c.cp || c.ciudad || c.prov) && (
                          <div className="text-xs text-slate-400">{[c.cp, c.ciudad, c.prov].filter(Boolean).join(", ")}</div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditCliente(c)} className="px-2 py-1 rounded text-xs font-bold bg-blue-600/20 text-blue-400">✎</button>
                        <button onClick={() => deleteCliente(c.id)} className={btnDanger}>✕</button>
                      </div>
                    </div>
                    <div className="flex gap-3 text-xs text-slate-500">
                      {c.mail && <span>✉ {c.mail}</span>}
                      {c.tel && <span>☎ {c.tel}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-slate-900 z-10">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Nombre</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">CIF</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Dirección</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Ciudad</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Email</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Tel</th>
                        <th className="text-center px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Acc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map(c => (
                        <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                          <td className="px-3 py-2 text-sm font-bold text-white">{c.nombre}</td>
                          <td className="px-3 py-2 text-sm text-slate-300">{c.cif || "—"}</td>
                          <td className="px-3 py-2 text-xs text-slate-400 max-w-[150px] truncate">{c.dir || "—"}</td>
                          <td className="px-3 py-2 text-xs text-slate-400">{[c.cp, c.ciudad, c.prov].filter(Boolean).join(", ") || "—"}</td>
                          <td className="px-3 py-2 text-xs text-slate-400">{c.mail || "—"}</td>
                          <td className="px-3 py-2 text-xs text-slate-400">{c.tel || "—"}</td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => openEditCliente(c)} className="px-2 py-1 rounded text-xs font-bold bg-blue-600/20 text-blue-400">✎</button>
                              <button onClick={() => deleteCliente(c.id)} className={btnDanger}>✕</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Cliente Modal */}
          {showClienteModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowClienteModal(false)}>
              <div className="bg-slate-800 border border-slate-600 rounded-2xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-white mb-4">{editClienteId ? "Editar Cliente" : "Nuevo Cliente"}</h3>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Nombre *</label>
                    <input value={clienteForm.nombre} onChange={e => setClienteForm(f => ({ ...f, nombre: e.target.value }))}
                      className={inputCls} placeholder="Nombre del cliente" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>CIF</label>
                      <input value={clienteForm.cif} onChange={e => setClienteForm(f => ({ ...f, cif: e.target.value }))}
                        className={inputCls} placeholder="B12345678" />
                    </div>
                    <div>
                      <label className={labelCls}>C.P.</label>
                      <input value={clienteForm.cp} onChange={e => setClienteForm(f => ({ ...f, cp: e.target.value }))}
                        className={inputCls} placeholder="28001" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Dirección</label>
                    <input value={clienteForm.dir} onChange={e => setClienteForm(f => ({ ...f, dir: e.target.value }))}
                      className={inputCls} placeholder="Calle Mayor, 1" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Ciudad</label>
                      <input value={clienteForm.ciudad} onChange={e => setClienteForm(f => ({ ...f, ciudad: e.target.value }))}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Provincia</label>
                      <input value={clienteForm.prov} onChange={e => setClienteForm(f => ({ ...f, prov: e.target.value }))}
                        className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Email</label>
                      <input type="email" value={clienteForm.mail} onChange={e => setClienteForm(f => ({ ...f, mail: e.target.value }))}
                        className={inputCls} placeholder="cliente@email.com" />
                    </div>
                    <div>
                      <label className={labelCls}>Teléfono</label>
                      <input value={clienteForm.tel} onChange={e => setClienteForm(f => ({ ...f, tel: e.target.value }))}
                        className={inputCls} placeholder="+34 600 000 000" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={saveCliente} className="flex-1 bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white font-bold py-2 rounded-lg text-sm transition">
                    {editClienteId ? "GUARDAR" : "CREAR"}
                  </button>
                  <button onClick={() => setShowClienteModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg text-sm transition">
                    CANCELAR
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          CATÁLOGO TAB
          ═══════════════════════════════════════════ */}
      {tab === "catalogo" && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-white text-sm">Catálogo de Precios ({catalogo.length})</h3>
            <button onClick={openNewCatalogo} className={btnPrimary}>+ Nuevo Ítem</button>
          </div>

          {catalogo.length === 0 ? (
            <div className={cardCls}>
              <div className="text-center text-slate-500 py-8 text-sm">No hay ítems en el catálogo</div>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-2 max-h-[600px] overflow-y-auto">
                {catalogo.map(c => (
                  <div key={c.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-bold text-white">{c.c1}</div>
                        <div className="text-xs text-slate-300">{c.c2}</div>
                        {c.cliente && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 mt-1 inline-block">
                            {c.cliente.nombre}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => openEditCatalogo(c)} className="px-2 py-1 rounded text-xs font-bold bg-blue-600/20 text-blue-400">✎</button>
                        <button onClick={() => deleteCatalogoItem(c.id)} className={btnDanger}>✕</button>
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs">
                      <span className="text-slate-400">Coste: <span className="text-white font-bold">{fmt(c.coste)}€</span></span>
                      <span className="text-slate-400">Inc: <span className="text-amber-400 font-bold">{c.inc}%</span></span>
                      <span className="text-slate-400">Final: <span className="text-amber-400 font-black">{fmt(c.final)}€</span></span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-slate-900 z-10">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">C1 (Grupo)</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">C2 (Servicio)</th>
                        <th className="text-right px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Coste</th>
                        <th className="text-right px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Inc %</th>
                        <th className="text-right px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Final</th>
                        <th className="text-left px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Cliente</th>
                        <th className="text-center px-3 py-2 text-xs font-extrabold text-blue-400 uppercase">Acc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catalogo.map(c => (
                        <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                          <td className="px-3 py-2 text-sm font-bold text-white">{c.c1}</td>
                          <td className="px-3 py-2 text-sm text-slate-300">{c.c2}</td>
                          <td className="px-3 py-2 text-sm text-slate-300 text-right">{fmt(c.coste)}€</td>
                          <td className="px-3 py-2 text-sm text-amber-400 text-right">{c.inc}%</td>
                          <td className="px-3 py-2 text-sm text-amber-400 font-bold text-right">{fmt(c.final)}€</td>
                          <td className="px-3 py-2">
                            {c.cliente ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-600/20 text-blue-400">{c.cliente.nombre}</span>
                            ) : (
                              <span className="text-xs text-slate-500">General</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => openEditCatalogo(c)} className="px-2 py-1 rounded text-xs font-bold bg-blue-600/20 text-blue-400">✎</button>
                              <button onClick={() => deleteCatalogoItem(c.id)} className={btnDanger}>✕</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Catalogo Modal */}
          {showCatalogoModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowCatalogoModal(false)}>
              <div className="bg-slate-800 border border-slate-600 rounded-2xl p-5 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-white mb-4">{editCatalogoId ? "Editar Ítem" : "Nuevo Ítem"}</h3>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Cliente (opcional, precio específico)</label>
                    <select value={catalogoForm.clienteId}
                      onChange={e => setCatalogoForm(f => ({ ...f, clienteId: e.target.value }))}
                      className={inputCls}>
                      <option value="">— General —</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>C1 (Grupo) *</label>
                      <input value={catalogoForm.c1} onChange={e => setCatalogoForm(f => ({ ...f, c1: e.target.value }))}
                        className={inputCls} placeholder="Grupo concepto" />
                    </div>
                    <div>
                      <label className={labelCls}>C2 (Servicio) *</label>
                      <input value={catalogoForm.c2} onChange={e => setCatalogoForm(f => ({ ...f, c2: e.target.value }))}
                        className={inputCls} placeholder="Servicio" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Coste (€)</label>
                      <input type="number" step="0.01" value={catalogoForm.coste}
                        onChange={e => setCatalogoForm(f => ({ ...f, coste: parseFloat(e.target.value) || 0 }))}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Incremento (%)</label>
                      <input type="number" step="0.1" value={catalogoForm.inc}
                        onChange={e => setCatalogoForm(f => ({ ...f, inc: parseFloat(e.target.value) || 0 }))}
                        className={inputCls} />
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded-lg px-3 py-2">
                    <span className="text-xs text-slate-400">Precio Final: </span>
                    <span className="text-amber-400 font-black">{fmt(catalogoForm.coste * (1 + catalogoForm.inc / 100))}€</span>
                    <span className="text-[10px] text-slate-500 ml-2">= {fmt(catalogoForm.coste)}€ × (1 + {catalogoForm.inc}%/100)</span>
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={saveCatalogo} className="flex-1 bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white font-bold py-2 rounded-lg text-sm transition">
                    {editCatalogoId ? "GUARDAR" : "CREAR"}
                  </button>
                  <button onClick={() => setShowCatalogoModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg text-sm transition">
                    CANCELAR
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          FACTURAS TAB
          ═══════════════════════════════════════════ */}
      {tab === "facturas" && (
        <div className="space-y-3">
          {/* Controls */}
          <div className={cardCls}>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className={labelCls}>Agrupar por</label>
                <select value={facturaGroupBy}
                  onChange={e => setFacturaGroupBy(e.target.value as "day" | "month")}
                  className={inputCls}>
                  <option value="day">Día</option>
                  <option value="month">Mes</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Cliente</label>
                <select value={facturaClienteFilter}
                  onChange={e => setFacturaClienteFilter(e.target.value)}
                  className={inputCls}>
                  <option value="">Todos</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={selectAllFacturas} className={btnSecondary}>Seleccionar todos</button>
                <button onClick={clearFacturaSelection} className={btnSecondary}>Limpiar</button>
              </div>
            </div>
          </div>

          {/* Selected summary */}
          {selectedFacturaIds.size > 0 && (
            <div className="bg-[#2E5D3A]/20 border border-[#2E5D3A]/30 rounded-xl p-3 sm:p-4">
              <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                  <div className="text-sm text-white">
                    <span className="font-bold">{selectedFacturaIds.size}</span> registros seleccionados
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Próxima factura: <span className="text-amber-400 font-bold">{generateInvoiceNumber()}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Base: <span className="text-white font-bold">{fmt(facturaBase)}€</span></div>
                  <div className="text-xs text-slate-400">IVA ({facturaIvaRate}%): <span className="text-white font-bold">{fmt(facturaIva)}€</span></div>
                  <div className="text-lg font-black text-amber-400">{fmt(facturaTotal)}€</div>
                </div>
                <button onClick={generateFactura}
                  className="bg-[#2E5D3A] hover:bg-[#3a7a4c] text-white font-bold px-4 py-2 rounded-lg text-sm transition flex items-center gap-2">
                  🖨 Generar Factura
                </button>
              </div>
            </div>
          )}

          {/* Grouped facturable registros */}
          {sortedGroupKeys.length === 0 ? (
            <div className={cardCls}>
              <div className="text-center text-slate-500 py-8 text-sm">No hay registros pendientes de facturación</div>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {sortedGroupKeys.map(key => {
                const groupItems = groupedFacturas[key];
                const groupTotal = groupItems.reduce((sum, r) => sum + r.cant * r.precioUnitario, 0);
                const allSelected = groupItems.every(r => selectedFacturaIds.has(r.id));

                return (
                  <div key={key} className={cardCls}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={allSelected}
                          onChange={() => toggleGroupSelect(key)}
                          className="w-4 h-4 accent-[#2E5D3A]" />
                        <span className="text-sm font-bold text-white">
                          {facturaGroupBy === "day" ? fmtDate(key) : key}
                        </span>
                        <span className="text-xs text-slate-400">({groupItems.length})</span>
                      </div>
                      <span className="text-amber-400 font-bold text-sm">{fmt(groupTotal)}€</span>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-1.5">
                      {groupItems.map(r => (
                        <div key={r.id} className={`flex items-center gap-2 bg-slate-900/50 rounded-lg p-2 ${selectedFacturaIds.has(r.id) ? "border border-[#2E5D3A]/50" : "border border-transparent"}`}>
                          <input type="checkbox" checked={selectedFacturaIds.has(r.id)}
                            onChange={() => toggleFacturaSelect(r.id)}
                            className="w-4 h-4 accent-[#2E5D3A] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white">{r.c1}{r.c2 ? " — " + r.c2 : ""}</div>
                            <div className="text-[10px] text-slate-400">{r.cliente || "Sin cliente"} · {r.cant} × {fmt(r.precioUnitario)}€</div>
                          </div>
                          <div className="text-amber-400 font-bold text-xs">{fmt(r.cant * r.precioUnitario)}€</div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="w-8 px-2 py-1"></th>
                            <th className="text-left px-2 py-1 text-[10px] font-extrabold text-blue-400 uppercase">Cliente</th>
                            <th className="text-left px-2 py-1 text-[10px] font-extrabold text-blue-400 uppercase">C1</th>
                            <th className="text-left px-2 py-1 text-[10px] font-extrabold text-blue-400 uppercase">C2</th>
                            <th className="text-right px-2 py-1 text-[10px] font-extrabold text-blue-400 uppercase">Cant</th>
                            <th className="text-right px-2 py-1 text-[10px] font-extrabold text-blue-400 uppercase">Precio</th>
                            <th className="text-right px-2 py-1 text-[10px] font-extrabold text-blue-400 uppercase">Total</th>
                            <th className="text-left px-2 py-1 text-[10px] font-extrabold text-blue-400 uppercase">Obs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupItems.map(r => (
                            <tr key={r.id} className={`border-b border-slate-700/30 ${selectedFacturaIds.has(r.id) ? "bg-[#2E5D3A]/10" : ""}`}>
                              <td className="px-2 py-1">
                                <input type="checkbox" checked={selectedFacturaIds.has(r.id)}
                                  onChange={() => toggleFacturaSelect(r.id)}
                                  className="w-4 h-4 accent-[#2E5D3A]" />
                              </td>
                              <td className="px-2 py-1 text-xs text-white">{r.cliente || "—"}</td>
                              <td className="px-2 py-1 text-xs text-white">{r.c1}</td>
                              <td className="px-2 py-1 text-xs text-slate-300">{r.c2}</td>
                              <td className="px-2 py-1 text-xs text-white text-right">{r.cant}</td>
                              <td className="px-2 py-1 text-xs text-slate-300 text-right">{fmt(r.precioUnitario)}€</td>
                              <td className="px-2 py-1 text-xs text-amber-400 font-bold text-right">{fmt(r.cant * r.precioUnitario)}€</td>
                              <td className="px-2 py-1 text-[10px] text-slate-500 max-w-[100px] truncate">{r.obs}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════
          CONFIGURACIÓN TAB
          ═══════════════════════════════════════════ */}
      {tab === "config" && (
        <div className="space-y-3">
          {/* Company info for invoicing */}
          <div className={cardCls}>
            <h3 className="font-bold text-white mb-3 text-sm">Datos de Facturación</h3>
            <p className="text-xs text-slate-400 mb-3">Estos datos aparecerán en las facturas generadas.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Nombre de la Empresa</label>
                <input value={configForm.companyFullName}
                  onChange={e => setConfigForm(f => ({ ...f, companyFullName: e.target.value }))}
                  className={inputCls} placeholder="Mi Empresa S.L." />
              </div>
              <div>
                <label className={labelCls}>CIF</label>
                <input value={configForm.companyCif}
                  onChange={e => setConfigForm(f => ({ ...f, companyCif: e.target.value }))}
                  className={inputCls} placeholder="B12345678" />
              </div>
              <div>
                <label className={labelCls}>Dirección</label>
                <input value={configForm.companyAddress}
                  onChange={e => setConfigForm(f => ({ ...f, companyAddress: e.target.value }))}
                  className={inputCls} placeholder="Calle Mayor, 1" />
              </div>
              <div>
                <label className={labelCls}>Ciudad</label>
                <input value={configForm.companyCity}
                  onChange={e => setConfigForm(f => ({ ...f, companyCity: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Provincia</label>
                <input value={configForm.companyProvince}
                  onChange={e => setConfigForm(f => ({ ...f, companyProvince: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Logo (URL o Base64)</label>
                <input value={configForm.logo}
                  onChange={e => setConfigForm(f => ({ ...f, logo: e.target.value }))}
                  className={inputCls} placeholder="https://..." />
              </div>
            </div>
          </div>

          {/* Invoice settings */}
          <div className={cardCls}>
            <h3 className="font-bold text-white mb-3 text-sm">Ajustes de Facturación</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>IVA por defecto (%)</label>
                <input type="number" step="0.1" value={configForm.defaultIva}
                  onChange={e => setConfigForm(f => ({ ...f, defaultIva: parseFloat(e.target.value) || 21 }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Próximo Nº Factura</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={facturaSeq?.seq || 1}
                    onChange={e => setFacturaSeq(prev => prev ? { ...prev, seq: parseInt(e.target.value) || 1 } : null)}
                    className={`${inputCls} flex-1`} />
                  <span className="text-slate-400 text-sm">/{new Date().getFullYear()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className={cardCls}>
            <h3 className="font-bold text-white mb-3 text-sm">Vista Previa Cabecera</h3>
            <div className="bg-white rounded-xl p-4">
              <div className="flex items-start gap-4">
                {configForm.logo && (
                  <img src={configForm.logo} alt="Logo" className="h-12 w-12 object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                <div>
                  <div className="text-lg font-bold text-gray-900">{configForm.companyFullName || "Nombre Empresa"}</div>
                  <div className="text-xs text-gray-500">
                    {[configForm.companyAddress, configForm.companyCity, configForm.companyProvince].filter(Boolean).join(", ")}
                  </div>
                  {configForm.companyCif && (
                    <div className="text-xs text-gray-500">CIF: {configForm.companyCif}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={saveConfig} disabled={savingConfig}
              className="bg-[#2E5D3A] hover:bg-[#3a7a4c] disabled:opacity-50 text-white font-bold px-5 py-2 rounded-lg text-sm transition">
              {savingConfig ? "Guardando..." : "GUARDAR CONFIGURACIÓN"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
