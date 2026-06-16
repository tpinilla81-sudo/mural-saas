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
  X,
  Plus,
  ArrowRight,
  Download,
  ChevronDown,
  ChevronRight,
  ListPlus,
} from 'lucide-react'
import { fmtCurrency, fmtDate, todayISO } from '@/lib/bill-utils'
import { useBillConfig } from '@/lib/bill-config'

const API = '/api/company/bill'

export interface DiarioLinea {
  id?: string
  catalogoId?: string | null
  c1: string
  c2: string
  cant: number
  precioUnitario: number
  obs: string
  orden?: number
}

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
  lineas?: DiarioLinea[]
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

interface CatalogoItem {
  id: string
  clienteId: string | null
  c1: string
  c2: string
  coste: number
  inc: number
  final: number
}

function useDiarioData() {
  const [items, setItems] = useState<DiarioItem[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [sedes, setSedes] = useState<Sede[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [catalogo, setCatalogo] = useState<CatalogoItem[]>([])
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [dRes, cRes, sRes, pRes, catRes] = await Promise.all([
        fetch(`${API}/diario`),
        fetch(`${API}/clientes`),
        fetch('/api/company/sedes'),
        fetch('/api/company/professionals'),
        fetch(`${API}/catalogo`),
      ])
      const d = await dRes.json()
      const c = await cRes.json()
      const s = await sRes.json()
      const p = await pRes.json()
      const cat = await catRes.json()
      setItems(Array.isArray(d) ? d : [])
      setClientes(Array.isArray(c) ? c : [])
      setSedes(Array.isArray(s) ? s : [])
      setProfessionals(Array.isArray(p) ? p : [])
      setCatalogo(Array.isArray(cat) ? cat : [])
    } catch (err) {
      console.error('Error loading diario data:', err)
    }
    setLoading(false)
  }, [])

  return { items, clientes, sedes, professionals, catalogo, loadData, loading }
}

export function DiarioView() {
  const {
    items,
    clientes,
    sedes,
    professionals,
    catalogo,
    loadData,
    loading,
  } = useDiarioData()
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

  // Edit modal (item header)
  const [editId, setEditId] = useState<string | null>(null)
  const [editFecha, setEditFecha] = useState('')
  const [editClienteId, setEditClienteId] = useState('')
  const [editObs, setEditObs] = useState('')
  const [editModalOpen, setEditModalOpen] = useState(false)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Expanded rows (showing lineas editor)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Lineas draft per item (local editing buffer)
  const [lineasDraft, setLineasDraft] = useState<Record<string, DiarioLinea[]>>({})

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
  // Importe = sum of líneas (if any) else fallback to item.precioUnitario*cant
  const totalImporte = filtered.reduce((sum, r) => {
    if (r.lineas && r.lineas.length > 0) {
      return sum + r.lineas.reduce((s, l) => s + l.precioUnitario * l.cant, 0)
    }
    return sum + r.precioUnitario * r.cant
  }, 0)

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
          sedeId: addSedeId && addSedeId !== '__none__' ? addSedeId : undefined,
          professionalId: addProfId && addProfId !== '__none__' ? addProfId : undefined,
          turn: addTurn,
          clienteId: addClienteId && addClienteId !== '__none__' ? addClienteId : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al crear item')
      showStatus('ok', 'Item añadido. Ahora añade líneas desde el catálogo.')
      setAddModalOpen(false)
      setAddFecha(todayISO())
      setAddSedeId('')
      setAddProfId('')
      setAddTurn('MANANA')
      setAddClienteId('')
      loadData()
    } catch (err: any) {
      showStatus('err', err.message)
    }
  }

  // ── Edit header ──
  function openEdit(item: DiarioItem) {
    setEditId(item.id)
    setEditFecha(item.fecha)
    setEditClienteId(item.clienteId || '')
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
    if (!confirm('¿Eliminar este item de diario y todas sus líneas?')) return
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
    if (!confirm(`¿Pasar ${ids.length} item(s) a facturación (REGISTROS)? Se creará un registro por cada línea.`)) return
    try {
      const res = await fetch(`${API}/diario/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al transferir')
      showStatus(
        'ok',
        `${data.transferred} item(s) transferido(s) → ${data.registrosCreated} registro(s) creado(s) · ${data.skipped} ya facturados`
      )
      setSelectedIds(new Set())
      loadData()
    } catch (err: any) {
      showStatus('err', err.message)
    }
  }

  // ── Excel export ──
  async function handleExport() {
    const XLSX = await import('xlsx')
    const rows = filtered.flatMap(r => {
      const lineas = r.lineas && r.lineas.length > 0 ? r.lineas : [
        { c1: r.c1, c2: r.c2, cant: r.cant, precioUnitario: r.precioUnitario, obs: r.obs },
      ]
      return lineas.map((l, i) => ({
        Fecha: r.fecha,
        Sede: r.sedeName,
        Profesional: r.professionalName,
        Turno: r.turn,
        Cliente: r.cliente,
        Línea: i + 1,
        Grupo: l.c1,
        Servicio: l.c2,
        Cantidad: l.cant,
        'P. Unitario': l.precioUnitario.toFixed(2),
        Importe: (l.precioUnitario * l.cant).toFixed(2),
        Observaciones: l.obs,
        Estado: r.status === 'FACTURADA' ? 'Facturada' : 'Cumplida',
        Origen: r.sourceType,
      }))
    })
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

  // ── Expand / collapse row + init lineas draft ──
  function toggleExpand(item: DiarioItem) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(item.id)) {
        next.delete(item.id)
      } else {
        next.add(item.id)
        // Initialize draft from current lineas
        setLineasDraft(d => ({
          ...d,
          [item.id]: item.lineas && item.lineas.length > 0
            ? item.lineas.map(l => ({ ...l }))
            : [],
        }))
      }
      return next
    })
  }

  // ── Lineas draft operations ──
  function addLinea(itemId: string) {
    setLineasDraft(d => {
      const current = d[itemId] || []
      return {
        ...d,
        [itemId]: [
          ...current,
          { c1: '', c2: '', cant: 1, precioUnitario: 0, obs: '', orden: current.length },
        ],
      }
    })
  }

  function updateLinea(itemId: string, idx: number, patch: Partial<DiarioLinea>) {
    setLineasDraft(d => {
      const current = [...(d[itemId] || [])]
      const line = { ...current[idx], ...patch }
      // If catalogoId set, resolve c1/c2/precio from catalog
      if (patch.catalogoId) {
        const cat = catalogo.find(c => c.id === patch.catalogoId)
        if (cat) {
          line.c1 = cat.c1
          line.c2 = cat.c2
          if (line.precioUnitario === 0) line.precioUnitario = cat.final
        }
      }
      current[idx] = line
      return { ...d, [itemId]: current }
    })
  }

  function removeLinea(itemId: string, idx: number) {
    setLineasDraft(d => {
      const current = [...(d[itemId] || [])]
      current.splice(idx, 1)
      return { ...d, [itemId]: current }
    })
  }

  async function saveLineas(itemId: string) {
    const draft = lineasDraft[itemId] || []
    try {
      const res = await fetch(`${API}/diario/${itemId}/lineas`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineas: draft }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Error al guardar líneas')
      }
      showStatus('ok', `${draft.length} línea(s) guardada(s)`)
      loadData()
    } catch (err: any) {
      showStatus('err', err.message)
    }
  }

  // ── Catalog filter for select (client-specific first, then generic) ──
  function catalogoOptionsForItem(item: DiarioItem) {
    const clientItems = catalogo.filter(c => c.clienteId === item.clienteId)
    const genericItems = catalogo.filter(c => !c.clienteId)
    return { clientItems, genericItems }
  }

  // ── Calculate importe for an item (sum of lineas if any, else fallback) ──
  function itemImporte(item: DiarioItem): number {
    if (item.lineas && item.lineas.length > 0) {
      return item.lineas.reduce((s, l) => s + l.precioUnitario * l.cant, 0)
    }
    return item.precioUnitario * item.cant
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
          Salida cumplida. Añade líneas desde el catálogo a cada salida. Esas líneas son lo que se factura.
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setSyncModalOpen(true)}>
            <RefreshCw className="h-4 w-4 mr-1" /> Sincronizar desde Diario
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAddModalOpen(true)}>
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
                <th className="p-2 text-center border-b bg-emerald-50 w-8"></th>
                <th className="p-2 text-center border-b bg-emerald-50 w-8">
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
                <th className="p-2 text-center font-semibold border-b bg-emerald-50">Líneas</th>
                <th className="p-2 text-right font-semibold border-b bg-emerald-50">Importe</th>
                <th className="p-2 text-center font-semibold border-b bg-emerald-50">Estado</th>
                <th className="p-2 text-center font-semibold border-b bg-emerald-50">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const isFacturada = r.status === 'FACTURADA'
                const isExpanded = expandedIds.has(r.id)
                const numLineas = r.lineas?.length || 0
                const importe = itemImporte(r)
                return (
                  <>
                    <tr
                      key={r.id}
                      className={`border-b hover:bg-gray-50 ${selectedIds.has(r.id) ? 'bg-emerald-50' : ''} ${isFacturada ? 'opacity-70' : ''}`}
                    >
                      <td className="p-2 text-center">
                        <button
                          onClick={() => toggleExpand(r)}
                          className="text-gray-400 hover:text-emerald-600"
                          title={isExpanded ? 'Contraer líneas' : 'Expandir líneas'}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </td>
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
                      <td className="p-2 text-center">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${numLineas > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {numLineas} {numLineas === 1 ? 'línea' : 'líneas'}
                        </span>
                      </td>
                      <td className="p-2 text-right font-bold">{fmtCurrency(importe, config?.currency || '€')}</td>
                      <td className="p-2 text-center">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${isFacturada ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {isFacturada ? 'Facturada' : 'Cumplida'}
                        </span>
                      </td>
                      <td className="p-2 text-center whitespace-nowrap">
                        {!isFacturada && (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" onClick={() => toggleExpand(r)} title="Ver/editar líneas">
                              <ListPlus className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-600 hover:bg-indigo-50" onClick={() => openEdit(r)} title="Editar item">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(r.id)} title="Eliminar">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        {isFacturada && <span className="text-[10px] text-gray-400">—</span>}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${r.id}-lineas`} className="bg-gray-50/50">
                        <td colSpan={11} className="p-3">
                          <LineasEditor
                            item={r}
                            draft={lineasDraft[r.id] || []}
                            catalogoOptions={catalogoOptionsForItem(r)}
                            onAdd={() => addLinea(r.id)}
                            onUpdate={(idx, patch) => updateLinea(r.id, idx, patch)}
                            onRemove={(idx) => removeLinea(r.id, idx)}
                            onSave={() => saveLineas(r.id)}
                            currency={config?.currency || '€'}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-6 text-center text-gray-400">
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
              con el mismo nombre. Después podrás añadir líneas desde el catálogo a cada salida.
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

      {/* Add modal (simplified: just header info; lineas added inline) */}
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
                <Select value={addSedeId || '__none__'} onValueChange={setAddSedeId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Sin sede —</SelectItem>
                    {sedes.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs uppercase font-bold text-slate-500">Profesional</Label>
                <Select value={addProfId || '__none__'} onValueChange={setAddProfId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Select value={addClienteId || '__none__'} onValueChange={setAddClienteId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sin cliente —</SelectItem>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
              Una vez creado el item, expándelo con el botón <ListPlus className="inline h-3 w-3" /> para añadir líneas desde el catálogo. Esas líneas son lo que se facturará.
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

      {/* Edit header modal */}
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

// ── Líneas editor (inline panel) ──
function LineasEditor({
  item,
  draft,
  catalogoOptions,
  onAdd,
  onUpdate,
  onRemove,
  onSave,
  currency,
}: {
  item: DiarioItem
  draft: DiarioLinea[]
  catalogoOptions: { clientItems: CatalogoItem[]; genericItems: CatalogoItem[] }
  onAdd: () => void
  onUpdate: (idx: number, patch: Partial<DiarioLinea>) => void
  onRemove: (idx: number) => void
  onSave: () => void
  currency: string
}) {
  const { clientItems, genericItems } = catalogoOptions
  const total = draft.reduce((s, l) => s + l.precioUnitario * l.cant, 0)

  return (
    <div className="border rounded-lg bg-white">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-emerald-50/50">
        <div className="text-sm font-bold text-emerald-700">
          Líneas a facturar — {item.sedeName} · {item.professionalName} · {fmtDate(item.fecha)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            Total: <b className="text-emerald-700">{fmtCurrency(total, currency)}</b>
          </span>
          <Button size="sm" variant="outline" onClick={onAdd}>
            <Plus className="h-3 w-3 mr-1" /> Añadir línea
          </Button>
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onSave}>
            <Save className="h-3 w-3 mr-1" /> Guardar
          </Button>
        </div>
      </div>

      <div className="max-h-[300px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className="bg-gray-100 text-gray-600">
              <th className="p-2 text-left font-semibold w-64">Catálogo</th>
              <th className="p-2 text-left font-semibold w-32">C1 (Grupo)</th>
              <th className="p-2 text-left font-semibold w-32">C2 (Servicio)</th>
              <th className="p-2 text-right font-semibold w-20">Cant</th>
              <th className="p-2 text-right font-semibold w-24">P.Unit</th>
              <th className="p-2 text-right font-semibold w-28">Importe</th>
              <th className="p-2 text-left font-semibold">Obs</th>
              <th className="p-2 text-center w-10"></th>
            </tr>
          </thead>
          <tbody>
            {draft.length === 0 && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-gray-400 text-xs">
                  Sin líneas. Añade desde el catálogo para definir qué se factura en esta salida.
                </td>
              </tr>
            )}
            {draft.map((l, idx) => {
              const importe = l.precioUnitario * l.cant
              return (
                <tr key={idx} className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    <Select
                      value={l.catalogoId || '__none__'}
                      onValueChange={(v) => onUpdate(idx, v === '__none__' ? { catalogoId: null } : { catalogoId: v })}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="— Manual —" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Manual —</SelectItem>
                        {clientItems.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50">
                              Específico de {item.cliente || 'cliente'}
                            </div>
                            {clientItems.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.c1} / {c.c2} — {fmtCurrency(c.final, currency)}
                              </SelectItem>
                            ))}
                          </>
                        )}
                        {genericItems.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-[10px] font-bold uppercase text-gray-500 bg-gray-50">
                              Genéricos
                            </div>
                            {genericItems.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.c1} / {c.c2} — {fmtCurrency(c.final, currency)}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Input
                      className="h-8 text-xs"
                      value={l.c1}
                      onChange={e => onUpdate(idx, { c1: e.target.value })}
                      disabled={!!l.catalogoId}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      className="h-8 text-xs"
                      value={l.c2}
                      onChange={e => onUpdate(idx, { c2: e.target.value })}
                      disabled={!!l.catalogoId}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      className="h-8 text-xs text-right"
                      value={l.cant}
                      onChange={e => onUpdate(idx, { cant: Number(e.target.value) || 1 })}
                    />
                  </td>
                  <td className="p-2">
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs text-right"
                      value={l.precioUnitario}
                      onChange={e => onUpdate(idx, { precioUnitario: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="p-2 text-right font-bold">
                    {fmtCurrency(importe, currency)}
                  </td>
                  <td className="p-2">
                    <Input
                      className="h-8 text-xs"
                      value={l.obs}
                      onChange={e => onUpdate(idx, { obs: e.target.value })}
                      placeholder="—"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-rose-600 hover:bg-rose-50"
                      onClick={() => onRemove(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
