'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  CalendarClock,
  RefreshCw,
  Filter,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2,
  Save,
  SquareCheck,
  X,
  Plus,
  ArrowRight,
  FileSpreadsheet,
  Download,
} from 'lucide-react'
import { fmtCurrency, fmtDate, todayISO } from '@/lib/bill-utils'
import { useBillConfig } from '@/lib/bill-config'

const API = '/api/company/bill'

export interface DiarioItem {
  id: string
  fecha: string
  sedeId: string | null
  sedeName: string
  professionalId: string | null
  professionalName: string
  turn: string
  clienteId: string | null
  cliente: string
  c1: string
  c2: string
  cant: number
  precioUnitario: number
  obs: string
  status: string // CUMPLIDA | FACTURADA
  sourceType: string // plan | manual
  sourceId: string | null
  registroId: string | null
  facturadoAt: string | null
}

interface Cliente {
  id: string
  nombre: string
}

interface Sede {
  id: string
  name: string
}

interface Professional {
  id: string
  firstName: string
  lastName: string
  alias: string
}

function useDiarioData() {
  const [items, setItems] = useState<DiarioItem[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dRes, cRes, sRes, pRes] = await Promise.all([
        fetch(`${API}/diario`),
        fetch(`${API}/clientes`),
        fetch('/api/company/sedes'),
        fetch('/api/company/professionals'),
      ])
      const d = await dRes.json()
      const c = await cRes.json()
      const s = await sRes.json()
      const p = await pRes.json()
      setItems(Array.isArray(d) ? d : [])
      setClientes(Array.isArray(c) ? c : [])
      setSedes(Array.isArray(s) ? s : [])
      setProfessionals(Array.isArray(p) ? p : [])
    } catch (err) {
      console.error('Error loading diario data:', err)
    }
    setLoading(false)
  }, [])

  return { items, clientes, sedes, professionals, loadData, loading }
}

export function DiarioView() {
  const { items, clientes, sedes, professionals, loadData, loading } = useDiarioData()
  const { config } = useBillConfig()

  // Filters
  const [fDesde, setFDesde] = useState('')
  const [fHasta, setFHasta] = useState('')
  const [fSede, setFSede] = useState('')
  const [fCliente, setFCliente] = useState('')
  const [fStatus, setFStatus] = useState<'all' | 'CUMPLIDA' | 'FACTURADA'>('all')
  const [fQ, setFQ] = useState('')
  const [showFilters, setShowFilters] = useState(true)

  // Sync modal
  const [syncModalOpen, setSyncModalOpen] = useState(false)
  const [syncFrom, setSyncFrom] = useState('')
  const [syncTo, setSyncTo] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ synced: number; skipped: number; total: number } | null>(null)

  // Manual add modal
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addFecha, setAddFecha] = useState(todayISO())
  const [addSedeId, setAddSedeId] = useState('')
  const [addProfId, setAddProfId] = useState('')
  const [addTurn, setAddTurn] = useState('MANANA')
  const [addClienteId, setAddClienteId] = useState('')
  const [addC1, setAddC1] = useState('Servicios')
  const [addC2, setAddC2] = useState('')
  const [addCant, setAddCant] = useState('1')
  const [addPrecio, setAddPrecio] = useState('')
  const [addObs, setAddObs] = useState('')

  // Edit modal
  const [editId, setEditId] = useState<string | null>(null)
  const [editFecha, setEditFecha] = useState('')
  const [editClienteId, setEditClienteId] = useState('')
  const [editC1, setEditC1] = useState('')
  const [editC2, setEditC2] = useState('')
  const [editCant, setEditCant] = useState('')
  const [editPrecio, setEditPrecio] = useState('')
  const [editObs, setEditObs] = useState('')
  const [editModalOpen, setEditModalOpen] = useState(false)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Status message
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => { loadData() }, [loadData])

  function showStatus(type: 'ok' | 'err', text: string) {
    setStatusMsg({ type, text })
    setTimeout(() => setStatusMsg(null), 5000)
  }

  // Filtered items
  const filtered = useMemo(() => items.filter(r => {
    if (fDesde && r.fecha < fDesde) return false
    if (fHasta && r.fecha > fHasta) return false
    if (fSede && r.sedeId !== fSede) return false
    if (fCliente && r.clienteId !== fCliente) return false
    if (fStatus !== 'all' && r.status !== fStatus) return false
    if (fQ) {
      const q = fQ.toLowerCase()
      const hay = `${r.sedeName} ${r.professionalName} ${r.cliente} ${r.c1} ${r.c2} ${r.obs}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }), [items, fDesde, fHasta, fSede, fCliente, fStatus, fQ])

  // Stats
  const totalCumplida = filtered.filter(r => r.status === 'CUMPLIDA').length
  const totalFacturada = filtered.filter(r => r.status === 'FACTURADA').length
  const totalImporte = filtered.reduce((sum, r) => sum + r.precioUnitario * r.cant, 0)

  // ── Sync from Diario ──
  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch(`${API}/diario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syncFrom: 'plans',
          from: syncFrom || undefined,
          to: syncTo || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar')
      setSyncResult(data)
      showStatus('ok', `${data.synced} entrada(s) sincronizada(s) desde Diario · ${data.skipped} ya existían`)
      loadData()
    } catch (err: any) {
      showStatus('err', err.message || 'Error al sincronizar')
    }
    setSyncing(false)
  }

  // ── Manual add ──
  async function handleAdd() {
    if (!addFecha) {
      showStatus('err', 'La fecha es obligatoria')
      return
    }
    try {
      const res = await fetch(`${API}/diario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: addFecha,
          sedeId: addSedeId || undefined,
          professionalId: addProfId || undefined,
          turn: addTurn,
          clienteId: addClienteId || undefined,
          c1: addC1,
          c2: addC2,
          cant: Number(addCant) || 1,
          precioUnitario: addPrecio ? Number(addPrecio) : 0,
          obs: addObs,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear item')
      showStatus('ok', 'Item añadido')
      setAddModalOpen(false)
      // Reset form
      setAddFecha(todayISO())
      setAddSedeId('')
      setAddProfId('')
      setAddTurn('MANANA')
      setAddClienteId('')
      setAddC1('Servicios')
      setAddC2('')
      setAddCant('1')
      setAddPrecio('')
      setAddObs('')
      loadData()
    } catch (err: any) {
      showStatus('err', err.message)
    }
  }

  // ── Edit ──
  function openEdit(item: DiarioItem) {
    setEditId(item.id)
    setEditFecha(item.fecha)
    setEditClienteId(item.clienteId || '')
    setEditC1(item.c1)
    setEditC2(item.c2)
    setEditCant(String(item.cant))
    setEditPrecio(String(item.precioUnitario))
    setEditObs(item.obs)
    setEditModalOpen(true)
  }

  async function handleEditSave() {
    if (!editId) return
    try {
      const res = await fetch(`${API}/diario/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha: editFecha,
          clienteId: editClienteId || null,
          c1: editC1,
          c2: editC2,
          cant: Number(editCant) || 1,
          precioUnitario: Number(editPrecio) || 0,
          obs: editObs,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Error al actualizar')
      }
      showStatus('ok', 'Item actualizado')
      setEditModalOpen(false)
      loadData()
    } catch (err: any) {
      showStatus('err', err.message)
    }
  }

  // ── Delete ──
  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este item de diario?')) return
    try {
      await fetch(`${API}/diario/${id}`, { method: 'DELETE' })
      showStatus('ok', 'Item eliminado')
      loadData()
    } catch (err) {
      showStatus('err', 'Error al eliminar')
    }
  }

  // ── Bulk transfer to REGISTROS (facturar) ──
  async function handleTransfer(ids: string[]) {
    if (ids.length === 0) return
    if (!confirm(`¿Pasar ${ids.length} item(s) a facturación (REGISTROS)?`)) return
    try {
      const res = await fetch(`${API}/diario/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al transferir')
      showStatus('ok', `${data.transferred} item(s) transferido(s) a REGISTROS · ${data.skipped} ya facturados`)
      setSelectedIds(new Set())
      loadData()
    } catch (err: any) {
      showStatus('err', err.message)
    }
  }

  // ── Excel export ──
  async function handleExport() {
    const XLSX = await import('xlsx')
    const rows = filtered.map(r => ({
      Fecha: r.fecha,
      Sede: r.sedeName,
      Profesional: r.professionalName,
      Turno: r.turn,
      Cliente: r.cliente,
      Grupo: r.c1,
      Servicio: r.c2,
      Cantidad: r.cant,
      'P. Unitario': r.precioUnitario.toFixed(2),
      Importe: (r.precioUnitario * r.cant).toFixed(2),
      Observaciones: r.obs,
      Estado: r.status === 'FACTURADA' ? 'Facturada' : 'Cumplida',
      Origen: r.sourceType,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Diario')
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    XLSX.writeFile(wb, `Diario_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.xlsx`)
  }

  // ── Selection ──
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const selectable = filtered.filter(r => r.status === 'CUMPLIDA')
    if (selectable.length > 0 && selectedIds.size === selectable.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectable.map(r => r.id)))
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Status */}
      {statusMsg && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mb-3 ${statusMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {statusMsg.type === 'ok' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {statusMsg.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <CalendarClock className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-bold text-gray-700">DIARIO → FACTURACIÓN</h2>
        <span className="text-xs text-gray-500 ml-1">
          Salida cumplida desde Diario. Selecciona y pasa a REGISTROS para facturar.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSyncModalOpen(true)}
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Sincronizar desde Diario
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setAddModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> Nuevo item
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Excel
          </Button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors ${showFilters ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
          >
            <Filter className="h-3 w-3" /> Filtros
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="mb-3">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] gap-3 items-end">
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Desde</Label>
                <Input type="date" value={fDesde} onChange={e => setFDesde(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Hasta</Label>
                <Input type="date" value={fHasta} onChange={e => setFHasta(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Sede</Label>
                <Select value={fSede} onValueChange={setFSede}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    {sedes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Cliente</Label>
                <Select value={fCliente} onValueChange={setFCliente}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Estado</Label>
                <Select value={fStatus} onValueChange={(v: any) => setFStatus(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="CUMPLIDA">Cumplida</SelectItem>
                    <SelectItem value="FACTURADA">Facturada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={() => { setFDesde(''); setFHasta(''); setFSede(''); setFCliente(''); setFStatus('all'); setFQ('') }}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2">
              <Label className="text-xs uppercase font-bold text-slate-500">Buscar</Label>
              <Input value={fQ} onChange={e => setFQ(e.target.value)} placeholder="Texto libre..." />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 bg-white rounded-lg px-4 py-2.5 shadow-sm text-sm font-bold border mb-3">
        <span>Total: <b className="text-emerald-700 ml-1">{filtered.length}</b></span>
        <span>Cumplidas: <b className="text-amber-600 ml-1">{totalCumplida}</b></span>
        <span>Facturadas: <b className="text-green-600 ml-1">{totalFacturada}</b></span>
        <span className="ml-auto">Importe total: <b className="text-emerald-700 ml-1">{fmtCurrency(totalImporte, config?.currency || '€')}</b></span>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2 rounded-lg mb-3 border border-emerald-200">
          <span className="text-sm font-bold text-emerald-700">{selectedIds.size} seleccionado(s)</span>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => handleTransfer([...selectedIds])}
          >
            <ArrowRight className="h-4 w-4 mr-1" /> Pasar a facturar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 bg-white rounded-lg border shadow-sm flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr className="bg-emerald-50">
                <th className="p-2 text-center border-b bg-emerald-50">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === filtered.filter(r => r.status === 'CUMPLIDA').length && filtered.filter(r => r.status === 'CUMPLIDA').length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                    title="Seleccionar todas las cumplidas"
                  />
                </th>
                <th className="p-2 text-left font-semibold border-b bg-emerald-50">Fecha</th>
                <th className="p-2 text-left font-semibold border-b bg-emerald-50">Sede</th>
                <th className="p-2 text-left font-semibold border-b bg-emerald-50">Profesional</th>
                <th className="p-2 text-left font-semibold border-b bg-emerald-50">Turno</th>
                <th className="p-2 text-left font-semibold border-b bg-emerald-50">Cliente</th>
                <th className="p-2 text-left font-semibold border-b bg-emerald-50">C1 / C2</th>
                <th className="p-2 text-right font-semibold border-b bg-emerald-50">Cant</th>
                <th className="p-2 text-right font-semibold border-b bg-emerald-50">P.Unit</th>
                <th className="p-2 text-right font-semibold border-b bg-emerald-50">Importe</th>
                <th className="p-2 text-center font-semibold border-b bg-emerald-50">Estado</th>
                <th className="p-2 text-center font-semibold border-b bg-emerald-50">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const importe = r.precioUnitario * r.cant
                const isFacturada = r.status === 'FACTURADA'
                return (
                  <tr
                    key={r.id}
                    className={`border-b hover:bg-gray-50 ${selectedIds.has(r.id) ? 'bg-emerald-50' : ''} ${isFacturada ? 'opacity-70' : ''}`}
                  >
                    <td className="p-2 text-center">
                      {!isFacturada && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          className="rounded"
                        />
                      )}
                    </td>
                    <td className="p-2 whitespace-nowrap">{fmtDate(r.fecha)}</td>
                    <td className="p-2">{r.sedeName || '—'}</td>
                    <td className="p-2">{r.professionalName || '—'}</td>
                    <td className="p-2">
                      <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${r.turn === 'MANANA' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {r.turn === 'MANANA' ? 'M' : r.turn === 'TARDE' ? 'T' : r.turn || '—'}
                      </span>
                    </td>
                    <td className="p-2">{r.cliente || '—'}</td>
                    <td className="p-2 text-xs">
                      <div className="font-semibold">{r.c1 || '—'}</div>
                      <div className="text-gray-500">{r.c2 || '—'}</div>
                    </td>
                    <td className="p-2 text-right">{r.cant}</td>
                    <td className="p-2 text-right">{r.precioUnitario.toFixed(2)}</td>
                    <td className="p-2 text-right font-bold">{fmtCurrency(importe, config?.currency || '€')}</td>
                    <td className="p-2 text-center">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${isFacturada ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {isFacturada ? 'Facturada' : 'Cumplida'}
                      </span>
                    </td>
                    <td className="p-2 text-center whitespace-nowrap">
                      {!isFacturada && (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-600 hover:bg-indigo-50" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {isFacturada && (
                        <span className="text-[10px] text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={12} className="p-6 text-center text-gray-400">
                    {loading ? 'Cargando...' : 'No hay items de diario. Pulsa "Sincronizar desde Diario" para importar entradas.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sync modal */}
      <Dialog open={syncModalOpen} onOpenChange={setSyncModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sincronizar desde Diario</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Importa las entradas del Diario (planes de profesionales en sedes) como salida cumplida.
              Se ignoran las entradas ya sincronizadas. Las sedes se mapean automáticamente a clientes
              con el mismo nombre.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Desde (opcional)</Label>
                <Input type="date" value={syncFrom} onChange={e => setSyncFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Hasta (opcional)</Label>
                <Input type="date" value={syncTo} onChange={e => setSyncTo(e.target.value)} />
              </div>
            </div>
            {syncResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                <div className="font-bold text-emerald-700">Sincronización completada</div>
                <div className="text-emerald-600 mt-1">
                  {syncResult.synced} nuevas · {syncResult.skipped} ya existían · {syncResult.total} total en Diario
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncModalOpen(false)}>Cerrar</Button>
            <Button onClick={handleSync} disabled={syncing} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {syncing ? <RefreshCw className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo item de diario (salida cumplida)</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Fecha</Label>
                <Input type="date" value={addFecha} onChange={e => setAddFecha(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Turno</Label>
                <Select value={addTurn} onValueChange={setAddTurn}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANANA">Mañana</SelectItem>
                    <SelectItem value="TARDE">Tarde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Sede</Label>
                <Select value={addSedeId} onValueChange={setAddSedeId}>
                  <SelectTrigger><SelectValue placeholder="— Sin sede —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sin sede —</SelectItem>
                    {sedes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Profesional</Label>
                <Select value={addProfId} onValueChange={setAddProfId}>
                  <SelectTrigger><SelectValue placeholder="— Sin profesional —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sin profesional —</SelectItem>
                    {professionals.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.alias || `${p.firstName} ${p.lastName}`.trim()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase font-bold text-slate-500">Cliente (facturable a)</Label>
              <Select value={addClienteId} onValueChange={setAddClienteId}>
                <SelectTrigger><SelectValue placeholder="— Sin cliente —" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin cliente —</SelectItem>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">C1 (Grupo)</Label>
                <Input value={addC1} onChange={e => setAddC1(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">C2 (Servicio)</Label>
                <Input value={addC2} onChange={e => setAddC2(e.target.value)} placeholder="Mañana, Tarde..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Cantidad</Label>
                <Input type="number" value={addCant} onChange={e => setAddCant(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Precio Unit. (0 = auto)</Label>
                <Input type="number" step="0.01" value={addPrecio} onChange={e => setAddPrecio(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase font-bold text-slate-500">Observaciones</Label>
              <Input value={addObs} onChange={e => setAddObs(e.target.value)} />
            </div>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" onClick={() => setAddModalOpen(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleAdd} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Save className="h-4 w-4 mr-1" /> CREAR
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar item de diario</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs uppercase font-bold text-slate-500">Fecha</Label>
              <Input type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs uppercase font-bold text-slate-500">Cliente</Label>
              <Select value={editClienteId || '__none__'} onValueChange={setEditClienteId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin cliente —</SelectItem>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">C1</Label>
                <Input value={editC1} onChange={e => setEditC1(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">C2</Label>
                <Input value={editC2} onChange={e => setEditC2(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Cantidad</Label>
                <Input type="number" value={editCant} onChange={e => setEditCant(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Precio Unit.</Label>
                <Input type="number" step="0.01" value={editPrecio} onChange={e => setEditPrecio(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs uppercase font-bold text-slate-500">Observaciones</Label>
              <Input value={editObs} onChange={e => setEditObs(e.target.value)} />
            </div>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" onClick={() => setEditModalOpen(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleEditSave} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Save className="h-4 w-4 mr-1" /> GUARDAR
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
