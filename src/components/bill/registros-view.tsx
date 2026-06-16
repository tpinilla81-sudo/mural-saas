'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Filter, RotateCcw, FileSpreadsheet, Table2, CheckCircle2, Upload, Download, CheckCircle, AlertCircle, Pencil, Trash2, Save, SquareCheck, X } from 'lucide-react'
import { fmtCurrency, fmtDate, getISOWeek, type Cliente, type CatalogoItem, type Registro } from '@/lib/bill-utils'
import { useBillConfig, DEFAULT_FIELDS_REGISTROS, type FieldDef, parseCustomData } from '@/lib/bill-config'

const API = '/api/company/bill'

interface RegistrosViewData {
  registros: Registro[]
  clientes: Cliente[]
  catalogo: CatalogoItem[]
}

function useRegistrosData() {
  const [data, setData] = useState<RegistrosViewData>({ registros: [], clientes: [], catalogo: [] })
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [rRes, cRes, catRes] = await Promise.all([
        fetch(`${API}/registros?filter=registros`),
        fetch(`${API}/clientes`),
        fetch(`${API}/catalogo`),
      ])
      const registros = await rRes.json()
      const clientes = await cRes.json()
      const catalogo = await catRes.json()
      setData({ registros: Array.isArray(registros) ? registros : [], clientes: Array.isArray(clientes) ? clientes : [], catalogo: Array.isArray(catalogo) ? catalogo : [] })
    } catch (err) {
      console.error('Error loading registros data:', err)
    }
    setLoading(false)
  }, [])

  return { data, loadData, loading }
}

export function RegistrosView() {
  const { data, loadData, loading } = useRegistrosData()
  const { config } = useBillConfig()
  const fieldDefs = config?.fieldsRegistros || DEFAULT_FIELDS_REGISTROS
  const visibleFields = fieldDefs.filter(f => f.visible)

  // Filters
  const [fDesde, setFDesde] = useState('')
  const [fHasta, setFHasta] = useState('')
  const [fCliente, setFCliente] = useState('')
  const [fC1, setFC1] = useState('')
  const [fC2, setFC2] = useState('')
  const [fQ, setFQ] = useState('')
  const [fFacturado, setFFacturado] = useState('all')

  // Excel
  const [showExcelTools, setShowExcelTools] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // UI
  const [showFilters, setShowFilters] = useState(true)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFecha, setEditFecha] = useState('')
  const [editClienteId, setEditClienteId] = useState('')
  const [editC1, setEditC1] = useState('')
  const [editC2, setEditC2] = useState('')
  const [editCant, setEditCant] = useState('')
  const [editObs, setEditObs] = useState('')
  const [editPrecioUnitario, setEditPrecioUnitario] = useState('')
  const [editModalOpen, setEditModalOpen] = useState(false)

  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => { loadData() }, [loadData])

  const { registros, clientes, catalogo } = data

  function getLabel(key: string): string {
    return fieldDefs.find(f => f.key === key)?.label || key
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

  const c1FilterOptions = useMemo(() => [...new Set(catalogo.map(x => x.c1))].sort(), [catalogo])
  const c2FilterOptions = useMemo(() => [...new Set(catalogo.filter(x => !fC1 || x.c1 === fC1).map(x => x.c2))].sort(), [catalogo, fC1])

  const filtered = useMemo(() => registros.filter(r => {
    if (fDesde && r.fecha < fDesde) return false
    if (fHasta && r.fecha > fHasta) return false
    if (fCliente && r.clienteId !== fCliente) return false
    if (fC1 && r.c1 !== fC1) return false
    if (fC2 && r.c2 !== fC2) return false
    if (fFacturado === 'si' && !r.facturado) return false
    if (fFacturado === 'no' && r.facturado) return false
    if (fQ && !((r.c1 + ' ' + r.c2 + ' ' + r.cliente + ' ' + r.obs).toLowerCase().includes(fQ.toLowerCase()))) return false
    return true
  }), [registros, fDesde, fHasta, fCliente, fC1, fC2, fFacturado, fQ])

  function showStatus(type: 'ok' | 'err', text: string) {
    setStatusMsg({ type, text }); setTimeout(() => setStatusMsg(null), 4000)
  }

  // Bulk operations
  async function handleMarkFacturado(ids: string[]) {
    if (ids.length === 0) return
    await fetch(`${API}/registros/mark-facturado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    showStatus('ok', `${ids.length} registro(s) marcado(s) como facturado`)
    setSelectedIds(new Set())
    loadData()
  }

  async function handleBulkDelete(ids: string[]) {
    if (ids.length === 0) return
    if (!confirm(`¿Eliminar ${ids.length} registro(s)?`)) return
    for (const id of ids) {
      await fetch(`${API}/registros/${id}`, { method: 'DELETE' })
    }
    showStatus('ok', `${ids.length} registro(s) eliminado(s)`)
    setSelectedIds(new Set())
    loadData()
  }

  // Edit
  function openEdit(r: Registro) {
    setEditingId(r.id)
    setEditFecha(r.fecha)
    setEditClienteId(r.clienteId || '')
    setEditC1(r.c1)
    setEditC2(r.c2)
    setEditCant(String(r.cant))
    setEditObs(r.obs)
    setEditPrecioUnitario(String(r.precioUnitario))
    setEditModalOpen(true)
  }

  async function handleEditSave() {
    if (!editingId) return
    await fetch(`${API}/registros/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha: editFecha,
        clienteId: editClienteId || null,
        c1: editC1, c2: editC2,
        cant: Number(editCant) || 1,
        precioUnitario: Number(editPrecioUnitario) || 0,
        obs: editObs,
      }),
    })
    setEditModalOpen(false)
    showStatus('ok', 'Registro actualizado')
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar registro?')) return
    await fetch(`${API}/registros/${id}`, { method: 'DELETE' })
    showStatus('ok', 'Registro eliminado')
    loadData()
  }

  // Selection
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)))
    }
  }

  // Excel export
  async function handleExportData() {
    const XLSX = await import('xlsx')
    const rows = filtered.map(r => {
      const precio = getPrecio(r)
      return {
        [getLabel('fecha')]: r.fecha,
        [getLabel('cliente')]: r.cliente,
        [getLabel('c1')]: r.c1,
        [getLabel('c2')]: r.c2,
        [getLabel('cantidad')]: r.cant,
        [getLabel('precioUnitario')]: precio.toFixed(2),
        [getLabel('importe')]: (precio * r.cant).toFixed(2),
        [getLabel('observaciones')]: r.obs,
        [getLabel('facturado')]: r.facturado ? 'Sí' : 'No',
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Registros')
    const _d = new Date(); const _p = (n: number) => String(n).padStart(2, '0')
    XLSX.writeFile(wb, `Registros_${_d.getFullYear()}-${_p(_d.getMonth() + 1)}-${_p(_d.getDate())}.xlsx`)
  }

  // Stats
  const totalFiltered = filtered.reduce((sum, r) => sum + getPrecio(r) * r.cant, 0)
  const facturados = filtered.filter(r => r.facturado).length
  const pendientes = filtered.filter(r => !r.facturado).length

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Status */}
      {statusMsg && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mb-3 ${statusMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {statusMsg.type === 'ok' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{statusMsg.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <Table2 className="h-5 w-5 text-[#005bb5]" />
        <h2 className="text-lg font-bold text-gray-700">{config?.sectionRegistros || 'REGISTROS'}</h2>
        <button onClick={() => setShowFilters(!showFilters)} className={`ml-2 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${showFilters ? 'bg-blue-50 text-[#005bb5] border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
          <Filter className="h-3 w-3" /> Filtros
        </button>
        <button onClick={() => setShowExcelTools(!showExcelTools)} className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${showExcelTools ? 'bg-blue-50 text-[#005bb5] border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
          <FileSpreadsheet className="h-3 w-3" /> Exportar
        </button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="mb-3">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto_auto] gap-3 items-end">
              <div><Label className="text-xs uppercase font-bold text-slate-500">Desde</Label><Input type="date" value={fDesde} onChange={e => setFDesde(e.target.value)} /></div>
              <div><Label className="text-xs uppercase font-bold text-slate-500">Hasta</Label><Input type="date" value={fHasta} onChange={e => setFHasta(e.target.value)} /></div>
              <div><Label className="text-xs uppercase font-bold text-slate-500">Cliente</Label><Select value={fCliente} onValueChange={setFCliente}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="__all__">Todos</SelectItem>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs uppercase font-bold text-slate-500">Grupo (C1)</Label><Select value={fC1} onValueChange={setFC1}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="__all__">Todos</SelectItem>{c1FilterOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs uppercase font-bold text-slate-500">Servicio (C2)</Label><Select value={fC2} onValueChange={setFC2}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="__all__">Todos</SelectItem>{c2FilterOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs uppercase font-bold text-slate-500">Estado</Label><Select value={fFacturado} onValueChange={setFFacturado}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="si">Facturado</SelectItem><SelectItem value="no">Pendiente</SelectItem></SelectContent></Select></div>
              <Button variant="outline" onClick={() => { setFDesde(''); setFHasta(''); setFCliente(''); setFC1(''); setFC2(''); setFFacturado('all'); setFQ('') }}><RotateCcw className="h-4 w-4" /></Button>
            </div>
            <div className="mt-2"><Label className="text-xs uppercase font-bold text-slate-500">Buscar</Label><Input value={fQ} onChange={e => setFQ(e.target.value)} placeholder="Texto libre..." /></div>
          </CardContent>
        </Card>
      )}

      {/* Excel tools */}
      {showExcelTools && (
        <Card className="mb-3">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleExportData} variant="outline" disabled={filtered.length === 0}><Download className="h-4 w-4 mr-2" /> EXPORTAR EXCEL</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 bg-white rounded-lg px-4 py-2.5 shadow-sm text-sm font-bold border mb-3">
        <span>Total:<b className="text-[#005bb5] ml-1">{filtered.length}</b></span>
        <span>Facturados:<b className="text-green-600 ml-1">{facturados}</b></span>
        <span>Pendientes:<b className="text-amber-600 ml-1">{pendientes}</b></span>
        <span className="ml-auto">Importe total:<b className="text-[#005bb5] ml-1">{fmtCurrency(totalFiltered, config?.currency || '€')}</b></span>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-lg mb-3 border border-indigo-200">
          <span className="text-sm font-bold text-indigo-700">{selectedIds.size} seleccionado(s)</span>
          <Button size="sm" className="bg-[#2bb24c] hover:bg-[#23963e] text-white" onClick={() => handleMarkFacturado([...selectedIds])}>
            <SquareCheck className="h-4 w-4 mr-1" /> Marcar facturado
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleBulkDelete([...selectedIds])}>
            <Trash2 className="h-4 w-4 mr-1" /> Eliminar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 bg-white rounded-lg border shadow-sm flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr className="bg-blue-50">
                <th className="p-2 text-center border-b bg-blue-50">
                  <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded" />
                </th>
                <th className="p-2 text-left font-semibold border-b bg-blue-50">Fecha</th>
                <th className="p-2 text-left font-semibold border-b bg-blue-50">Cliente</th>
                <th className="p-2 text-left font-semibold border-b bg-blue-50">C1</th>
                <th className="p-2 text-left font-semibold border-b bg-blue-50">C2</th>
                <th className="p-2 text-right font-semibold border-b bg-blue-50">Cant</th>
                <th className="p-2 text-right font-semibold border-b bg-blue-50">P.Unit</th>
                <th className="p-2 text-right font-semibold border-b bg-blue-50">Importe</th>
                <th className="p-2 text-left font-semibold border-b bg-blue-50">Obs</th>
                <th className="p-2 text-center font-semibold border-b bg-blue-50">Estado</th>
                <th className="p-2 text-center font-semibold border-b bg-blue-50">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const precio = getPrecio(r)
                const importe = precio * r.cant
                return (
                  <tr key={r.id} className={`border-b hover:bg-gray-50 ${selectedIds.has(r.id) ? 'bg-indigo-50' : ''}`}>
                    <td className="p-2 text-center">
                      <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} className="rounded" />
                    </td>
                    <td className="p-2">{fmtDate(r.fecha)}</td>
                    <td className="p-2">{r.cliente || '—'}</td>
                    <td className="p-2">{r.c1}</td>
                    <td className="p-2">{r.c2}</td>
                    <td className="p-2 text-right">{r.cant}</td>
                    <td className="p-2 text-right">{precio.toFixed(2)}</td>
                    <td className="p-2 text-right font-bold">{fmtCurrency(importe, config?.currency || '€')}</td>
                    <td className="p-2 text-gray-500 text-xs max-w-[120px] truncate">{r.obs}</td>
                    <td className="p-2 text-center">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${r.facturado ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.facturado ? 'Facturado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="p-2 text-center">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-600 hover:bg-indigo-50" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="p-6 text-center text-gray-400">No hay registros</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Registro</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label className="text-xs uppercase font-bold text-slate-500">Fecha</Label><Input type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)} /></div>
            <div><Label className="text-xs uppercase font-bold text-slate-500">Cliente</Label>
              <Select value={editClienteId || '__none__'} onValueChange={setEditClienteId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="__none__">— Sin cliente —</SelectItem>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs uppercase font-bold text-slate-500">C1</Label><Input value={editC1} onChange={e => setEditC1(e.target.value)} /></div>
              <div><Label className="text-xs uppercase font-bold text-slate-500">C2</Label><Input value={editC2} onChange={e => setEditC2(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs uppercase font-bold text-slate-500">Cantidad</Label><Input type="number" value={editCant} onChange={e => setEditCant(e.target.value)} /></div>
              <div><Label className="text-xs uppercase font-bold text-slate-500">Precio Unit.</Label><Input type="number" step="0.01" value={editPrecioUnitario} onChange={e => setEditPrecioUnitario(e.target.value)} /></div>
            </div>
            <div><Label className="text-xs uppercase font-bold text-slate-500">Observaciones</Label><Input value={editObs} onChange={e => setEditObs(e.target.value)} /></div>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" onClick={() => setEditModalOpen(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleEditSave} className="flex-1 bg-[#005bb5] hover:bg-[#003d7a] text-white"><Save className="h-4 w-4 mr-1" />GUARDAR</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
