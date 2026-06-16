'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Printer, FileSpreadsheet, Receipt, RotateCcw, ArrowLeftRight, CheckCircle2, X, Filter } from 'lucide-react'
import { fmtCurrency, fmtDate, fmtMonth, todayISO, currentYear, type Cliente, type CatalogoItem, type Registro } from '@/lib/bill-utils'
import { useBillConfig, DEFAULT_FIELDS_FACTURAS, type ResolvedConfig } from '@/lib/bill-config'

const API = '/api/company/bill'

interface FacturasData {
  registros: Registro[]
  clientes: Cliente[]
  catalogo: CatalogoItem[]
  seq: number
}

type LineaFactura = { fecha: string; c1: string; c2: string; cant: number; clienteId: string; obs: string; precioUnitario: number }
interface InvoiceData {
  cli: Cliente; lineas: LineaFactura[]
  iva: number; numero: string; fechaFact: string; modo: string; base: number; ivaImp: number; total: number
}

export function FacturasView() {
  const { config } = useBillConfig()
  const [data, setData] = useState<FacturasData>({ registros: [], clientes: [], catalogo: [], seq: 1 })
  // Filters
  const [fDesde, setFDesde] = useState('')
  const [fHasta, setFHasta] = useState('')
  const [fCliente, setFCliente] = useState('')
  const [fFacturado, setFFacturado] = useState('no')
  const [showFilters, setShowFilters] = useState(true)

  // Invoice generation
  const [invoiceMode, setInvoiceMode] = useState<'cliente' | 'mes'>('cliente')
  const [selectedClienteId, setSelectedClienteId] = useState('')
  const [invoiceIva, setInvoiceIva] = useState(config?.defaultIva ?? 21)
  const [invoiceFecha, setInvoiceFecha] = useState(todayISO())

  // Preview
  const [previewInvoice, setPreviewInvoice] = useState<InvoiceData | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Generated invoices list
  const [generatedInvoices, setGeneratedInvoices] = useState<InvoiceData[]>([])

  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const loadData = useCallback(async () => {
    const [rRes, cRes, catRes, seqRes] = await Promise.all([
      fetch(`${API}/registros?filter=registros`),
      fetch(`${API}/clientes`),
      fetch(`${API}/catalogo`),
      fetch(`${API}/factura-seq`),
    ])
    const registros = await rRes.json()
    const clientes = await cRes.json()
    const catalogo = await catRes.json()
    const seqData = await seqRes.json()
    setData({
      registros: Array.isArray(registros) ? registros : [],
      clientes: Array.isArray(clientes) ? clientes : [],
      catalogo: Array.isArray(catalogo) ? catalogo : [],
      seq: seqData?.seq || 1,
    })
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Update IVA when config loads
  useEffect(() => {
    if (config?.defaultIva) setInvoiceIva(config.defaultIva)
  }, [config?.defaultIva])

  const { registros, clientes, catalogo, seq } = data

  // Filter registros for facturación
  const filtered = useMemo(() => registros.filter(r => {
    if (fDesde && r.fecha < fDesde) return false
    if (fHasta && r.fecha > fHasta) return false
    if (fCliente && r.clienteId !== fCliente) return false
    if (fFacturado === 'si' && !r.facturado) return false
    if (fFacturado === 'no' && r.facturado) return false
    return true
  }), [registros, fDesde, fHasta, fCliente, fFacturado])

  // Available registros for invoice (not yet facturado, with clienteId)
  const availableForInvoice = filtered.filter(r => !r.facturado && r.clienteId)

  // Group by client
  const byClient = useMemo(() => {
    const map = new Map<string, Registro[]>()
    availableForInvoice.forEach(r => {
      const key = r.clienteId || '__no__'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    return map
  }, [availableForInvoice])

  function showStatus(type: 'ok' | 'err', text: string) {
    setStatusMsg({ type, text }); setTimeout(() => setStatusMsg(null), 4000)
  }

  function precioUnit(c1Val: string, c2Val: string, cliId: string | null): number {
    let it = catalogo.find(x => x.c1 === c1Val && x.c2 === c2Val && x.clienteId === cliId)
    if (!it) it = catalogo.find(x => x.c1 === c1Val && x.c2 === c2Val && !x.clienteId)
    if (!it) it = catalogo.find(x => x.c1 === c1Val && x.c2 === c2Val)
    return it ? Number(it.final) || 0 : 0
  }

  function getPrecio(r: Registro): number {
    return r.precioUnitario > 0 ? r.precioUnitario : precioUnit(r.c1, r.c2, r.clienteId)
  }

  // Generate invoice preview
  function handlePreviewInvoice(clienteId: string) {
    const cli = clientes.find(c => c.id === clienteId)
    if (!cli) return
    const regs = byClient.get(clienteId) || []
    if (regs.length === 0) return

    const lineas: LineaFactura[] = regs.map(r => ({
      fecha: r.fecha, c1: r.c1, c2: r.c2, cant: r.cant,
      clienteId: r.clienteId || '', obs: r.obs,
      precioUnitario: getPrecio(r),
    }))

    const base = lineas.reduce((s, l) => s + l.precioUnitario * l.cant, 0)
    const ivaImp = base * (invoiceIva / 100)
    const total = base + ivaImp
    const numero = `F${String(seq).padStart(4, '0')}`

    setPreviewInvoice({ cli, lineas, iva: invoiceIva, numero, fechaFact: invoiceFecha, modo: invoiceMode, base, ivaImp, total })
    setPreviewOpen(true)
  }

  // Confirm invoice
  async function handleConfirmInvoice() {
    if (!previewInvoice) return
    const regIds = byClient.get(previewInvoice.cli.id)?.map(r => r.id) || []
    if (regIds.length === 0) return

    // Mark as facturado
    await fetch(`${API}/registros/mark-facturado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: regIds }),
    })

    // Increment sequence
    await fetch(`${API}/factura-seq`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seq: seq + 1 }),
    })

    setGeneratedInvoices(prev => [...prev, previewInvoice])
    setPreviewOpen(false)
    setPreviewInvoice(null)
    showStatus('ok', `Factura ${previewInvoice.numero} generada correctamente`)
    loadData()
  }

  // Print invoice
  function handlePrintInvoice(inv: InvoiceData) {
    const cur = config?.currency || '€'
    const printHtml = `
      <!DOCTYPE html><html><head><title>Factura ${inv.numero}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .company { font-size: 14px; } .company b { font-size: 18px; }
        .invoice-title { text-align: right; font-size: 24px; font-weight: bold; color: #005bb5; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #005bb5; color: white; padding: 8px; text-align: left; font-size: 12px; }
        td { padding: 8px; border-bottom: 1px solid #eee; font-size: 13px; }
        .totals { margin-top: 20px; text-align: right; }
        .totals td { padding: 4px 8px; } .totals .total-row { font-weight: bold; font-size: 16px; color: #005bb5; }
        .footer { margin-top: 40px; font-size: 11px; color: #999; text-align: center; }
      </style></head><body>
      <div class="header">
        <div class="company">
          <b>${config?.companyFullName || config?.appName || 'BILL by Método'}</b><br/>
          ${config?.companyAddress ? config.companyAddress + '<br/>' : ''}
          ${config?.companyCity ? config.companyCity + (config.companyProvince ? ', ' + config.companyProvince : '') : ''}<br/>
          ${config?.companyCif ? 'CIF: ' + config.companyCif : ''}
        </div>
        <div>
          <div class="invoice-title">FACTURA</div>
          <div style="text-align:right; margin-top: 10px;">
            Nº: <b>${inv.numero}</b><br/>
            Fecha: <b>${fmtDate(inv.fechaFact)}</b>
          </div>
        </div>
      </div>
      <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
        <b>Cliente:</b> ${inv.cli.nombre}<br/>
        ${inv.cli.cif ? 'CIF: ' + inv.cli.cif + '<br/>' : ''}
        ${inv.cli.dir ? inv.cli.dir + '<br/>' : ''}
        ${inv.cli.ciudad ? inv.cli.ciudad + (inv.cli.prov ? ', ' + inv.cli.prov : '') + (inv.cli.cp ? ' ' + inv.cli.cp : '') : ''}
      </div>
      <table>
        <thead><tr><th>Fecha</th><th>Concepto</th><th style="text-align:right">Cant.</th><th style="text-align:right">P.Unit</th><th style="text-align:right">Importe</th></tr></thead>
        <tbody>
          ${inv.lineas.map(l => `<tr><td>${fmtDate(l.fecha)}</td><td>${l.c1} — ${l.c2}${l.obs ? ' (' + l.obs + ')' : ''}</td><td style="text-align:right">${l.cant}</td><td style="text-align:right">${l.precioUnitario.toFixed(2)} ${cur}</td><td style="text-align:right">${(l.precioUnitario * l.cant).toFixed(2)} ${cur}</td></tr>`).join('')}
        </tbody>
      </table>
      <table class="totals" style="width: 300px; margin-left: auto;">
        <tr><td>Base imponible</td><td style="text-align:right">${inv.base.toFixed(2)} ${cur}</td></tr>
        <tr><td>IVA (${inv.iva}%)</td><td style="text-align:right">${inv.ivaImp.toFixed(2)} ${cur}</td></tr>
        <tr class="total-row"><td>TOTAL</td><td style="text-align:right">${inv.total.toFixed(2)} ${cur}</td></tr>
      </table>
      <div class="footer">Factura generada por ${config?.appName || 'BILL by Método'}</div>
      <script>window.onload = function() { window.print(); }</script>
      </body></html>
    `
    const w = window.open('', '_blank')
    if (w) { w.document.write(printHtml); w.document.close() }
  }

  // Export invoices to Excel
  async function handleExportExcel() {
    const XLSX = await import('xlsx')
    const rows = filtered.map(r => ({
      Fecha: fmtDate(r.fecha),
      Cliente: r.cliente,
      'Concepto 1': r.c1,
      'Concepto 2': r.c2,
      Cantidad: r.cant,
      'Precio Unit.': getPrecio(r).toFixed(2),
      Importe: (getPrecio(r) * r.cant).toFixed(2),
      Facturado: r.facturado ? 'Sí' : 'No',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Registros')
    XLSX.writeFile(wb, `Facturas_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Status */}
      {statusMsg && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mb-3 ${statusMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {statusMsg.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <X className="h-4 w-4" />}{statusMsg.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Receipt className="h-5 w-5 text-[#005bb5]" />
        <h2 className="text-lg font-bold text-gray-700">{config?.sectionFacturas || 'FACTURAS'}</h2>
        <button onClick={() => setShowFilters(!showFilters)} className={`ml-2 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${showFilters ? 'bg-blue-50 text-[#005bb5] border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
          <Filter className="h-3 w-3" /> Filtros
        </button>
        <Button variant="outline" size="sm" className="ml-auto" onClick={handleExportExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Exportar
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="mb-3">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-3 items-end">
              <div><Label className="text-xs uppercase font-bold text-slate-500">Desde</Label><Input type="date" value={fDesde} onChange={e => setFDesde(e.target.value)} /></div>
              <div><Label className="text-xs uppercase font-bold text-slate-500">Hasta</Label><Input type="date" value={fHasta} onChange={e => setFHasta(e.target.value)} /></div>
              <div><Label className="text-xs uppercase font-bold text-slate-500">Cliente</Label><Select value={fCliente} onValueChange={setFCliente}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="__all__">Todos</SelectItem>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs uppercase font-bold text-slate-500">Estado</Label><Select value={fFacturado} onValueChange={setFFacturado}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="no">Pendiente</SelectItem><SelectItem value="si">Facturado</SelectItem></SelectContent></Select></div>
              <Button variant="outline" onClick={() => { setFDesde(''); setFHasta(''); setFCliente(''); setFFacturado('no') }}><RotateCcw className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice generation card */}
      <Card className="mb-3 border-l-4 border-l-[#005bb5]">
        <CardContent className="p-4">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Generar Factura</h3>
          <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
            <div>
              <Label className="text-xs uppercase font-bold text-slate-500">Cliente</Label>
              <Select value={selectedClienteId} onValueChange={setSelectedClienteId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>
                  {[...byClient.entries()].map(([id, regs]) => {
                    const cli = clientes.find(c => c.id === id)
                    if (!cli) return null
                    const total = regs.reduce((s, r) => s + getPrecio(r) * r.cant, 0)
                    return <SelectItem key={id} value={id}>{cli.nombre} ({regs.length} reg. — {fmtCurrency(total, config?.currency || '€')})</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs uppercase font-bold text-slate-500">IVA %</Label><Input type="number" step="1" value={invoiceIva} onChange={e => setInvoiceIva(Number(e.target.value))} /></div>
            <div><Label className="text-xs uppercase font-bold text-slate-500">Fecha factura</Label><Input type="date" value={invoiceFecha} onChange={e => setInvoiceFecha(e.target.value)} /></div>
            <Button
              onClick={() => selectedClienteId && handlePreviewInvoice(selectedClienteId)}
              disabled={!selectedClienteId}
              className="bg-[#005bb5] hover:bg-[#003d7a] text-white"
            >
              <Receipt className="h-4 w-4 mr-1" /> GENERAR
            </Button>
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {availableForInvoice.length} registros disponibles para facturar · {byClient.size} clientes con registros pendientes
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 bg-white rounded-lg px-4 py-2.5 shadow-sm text-sm font-bold border mb-3">
        <span>Pendientes:<b className="text-amber-600 ml-1">{availableForInvoice.length}</b></span>
        <span>Clientes:<b className="text-[#005bb5] ml-1">{byClient.size}</b></span>
        <span className="ml-auto">Próxima factura:<b className="text-[#005bb5] ml-1">F{String(seq).padStart(4, '0')}</b></span>
      </div>

      {/* Client cards for quick invoicing */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
        {[...byClient.entries()].map(([clienteId, regs]) => {
          const cli = clientes.find(c => c.id === clienteId)
          if (!cli) return null
          const total = regs.reduce((s, r) => s + getPrecio(r) * r.cant, 0)
          return (
            <Card key={clienteId} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelectedClienteId(clienteId); handlePreviewInvoice(clienteId) }}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-700">{cli.nombre}</p>
                    <p className="text-xs text-gray-500">{regs.length} registro(s) pendiente(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#005bb5]">{fmtCurrency(total, config?.currency || '€')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {byClient.size === 0 && (
          <div className="col-span-full text-center py-8 text-gray-400">No hay registros pendientes de facturación</div>
        )}
      </div>

      {/* Generated invoices */}
      {generatedInvoices.length > 0 && (
        <div className="mt-3">
          <h3 className="text-sm font-bold text-gray-700 mb-2">Facturas generadas esta sesión</h3>
          <div className="space-y-2">
            {generatedInvoices.map((inv, i) => (
              <div key={i} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <div>
                  <span className="font-bold text-green-700">{inv.numero}</span>
                  <span className="text-sm text-gray-600 ml-2">— {inv.cli.nombre}</span>
                  <span className="text-sm text-gray-500 ml-2">({inv.lineas.length} líneas)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-green-700">{fmtCurrency(inv.total, config?.currency || '€')}</span>
                  <Button size="sm" variant="outline" onClick={() => handlePrintInvoice(inv)}>
                    <Printer className="h-4 w-4 mr-1" /> Imprimir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[700px] max-h-[85vh] overflow-auto">
          <DialogHeader><DialogTitle>Vista Previa — Factura {previewInvoice?.numero}</DialogTitle></DialogHeader>
          {previewInvoice && (
            <div>
              {/* Client info */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="font-bold">{previewInvoice.cli.nombre}</p>
                {previewInvoice.cli.cif && <p className="text-sm text-gray-600">CIF: {previewInvoice.cli.cif}</p>}
                {previewInvoice.cli.dir && <p className="text-sm text-gray-600">{previewInvoice.cli.dir}</p>}
                {previewInvoice.cli.ciudad && <p className="text-sm text-gray-600">{previewInvoice.cli.ciudad}{previewInvoice.cli.prov ? ', ' + previewInvoice.cli.prov : ''}</p>}
              </div>

              {/* Lines table */}
              <table className="w-full text-sm mb-4">
                <thead><tr className="bg-blue-50"><th className="p-2 text-left">Fecha</th><th className="p-2 text-left">Concepto</th><th className="p-2 text-right">Cant</th><th className="p-2 text-right">P.Unit</th><th className="p-2 text-right">Importe</th></tr></thead>
                <tbody>
                  {previewInvoice.lineas.map((l, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">{fmtDate(l.fecha)}</td>
                      <td className="p-2">{l.c1} — {l.c2}</td>
                      <td className="p-2 text-right">{l.cant}</td>
                      <td className="p-2 text-right">{l.precioUnitario.toFixed(2)}</td>
                      <td className="p-2 text-right font-bold">{(l.precioUnitario * l.cant).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="text-right space-y-1">
                <p>Base imponible: <b>{fmtCurrency(previewInvoice.base, config?.currency || '€')}</b></p>
                <p>IVA ({previewInvoice.iva}%): <b>{fmtCurrency(previewInvoice.ivaImp, config?.currency || '€')}</b></p>
                <p className="text-lg font-bold text-[#005bb5]">TOTAL: {fmtCurrency(previewInvoice.total, config?.currency || '€')}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setPreviewOpen(false)} className="flex-1">Cancelar</Button>
                <Button onClick={handleConfirmInvoice} className="flex-1 bg-[#2bb24c] hover:bg-[#23963e] text-white font-bold">
                  CONFIRMAR FACTURA
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
