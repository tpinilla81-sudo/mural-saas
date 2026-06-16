'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pencil, Trash2, Save, CheckCircle, AlertCircle, X, ArrowRightCircle, ChevronDown, Plus } from 'lucide-react'
import { todayISO, type Cliente, type CatalogoItem, type Registro } from '@/lib/bill-utils'
import { useBillConfig, DEFAULT_FIELDS_ENTRADA, type FieldDef, parseCustomData, serializeCustomData } from '@/lib/bill-config'

const API = '/api/company/bill'

interface EntradaViewData {
  registros: Registro[]
  clientes: Cliente[]
  catalogo: CatalogoItem[]
}

function useEntradaData() {
  const [data, setData] = useState<EntradaViewData>({ registros: [], clientes: [], catalogo: [] })
  const [loading, setLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [rRes, cRes, catRes] = await Promise.all([
        fetch(`${API}/registros?filter=entrada`),
        fetch(`${API}/clientes`),
        fetch(`${API}/catalogo`),
      ])
      const registros = await rRes.json()
      const clientes = await cRes.json()
      const catalogo = await catRes.json()
      setData({ registros: Array.isArray(registros) ? registros : [], clientes: Array.isArray(clientes) ? clientes : [], catalogo: Array.isArray(catalogo) ? catalogo : [] })
    } catch (err) {
      console.error('Error loading entrada data:', err)
    }
    setLoading(false)
  }, [])

  return { data, loadData, loading }
}

// ComboInput: text input with dropdown suggestions
function ComboInput({
  value,
  onChange,
  suggestions,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const filtered = suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase())

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <Input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full bg-white border rounded-lg shadow-lg max-h-40 overflow-auto mt-1">
          {filtered.slice(0, 8).map(s => (
            <button
              key={s}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 transition-colors"
              onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false) }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function EntradaView() {
  const { data, loadData, loading } = useEntradaData()
  const { config } = useBillConfig()
  const fieldDefs = config?.fieldsEntrada || DEFAULT_FIELDS_ENTRADA
  const visibleFields = fieldDefs.filter(f => f.visible)

  // Form state
  const [fecha, setFecha] = useState(todayISO())
  const [clienteId, setClienteId] = useState('')
  const [c1, setC1] = useState('')
  const [c2, setC2] = useState('')
  const [cant, setCant] = useState('1')
  const [obs, setObs] = useState('')
  const [customValues, setCustomValues] = useState<Record<string, string>>({})

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)

  // Quick-add state
  const [quickAdd, setQuickAdd] = useState(false)

  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => { loadData() }, [loadData])

  const { registros, clientes, catalogo } = data

  // Auto-lookup precio from catalog
  const precioUnit = useMemo(() => {
    const effectiveClienteId = (clienteId === '__none__' || !clienteId) ? null : clienteId
    let it = catalogo.find(x => x.c1 === c1 && x.c2 === c2 && x.clienteId === effectiveClienteId)
    if (!it) it = catalogo.find(x => x.c1 === c1 && x.c2 === c2 && !x.clienteId)
    if (!it) it = catalogo.find(x => x.c1 === c1 && x.c2 === c2)
    return it ? it.final : 0
  }, [c1, c2, clienteId, catalogo])

  const c1Options = useMemo(() => [...new Set(catalogo.map(x => x.c1))].sort(), [catalogo])
  const c2Options = useMemo(() => [...new Set(catalogo.filter(x => !c1 || x.c1 === c1).map(x => x.c2))].sort(), [catalogo, c1])

  function showStatus(type: 'ok' | 'err', text: string) {
    setStatusMsg({ type, text })
    setTimeout(() => setStatusMsg(null), 4000)
  }

  function resetForm() {
    setEditingId(null)
    setFecha(todayISO())
    setClienteId('')
    setC1('')
    setC2('')
    setCant('1')
    setObs('')
    setCustomValues({})
  }

  function setCustomValue(key: string, value: string) {
    setCustomValues(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!fecha) { showStatus('err', 'Fecha obligatoria'); return }
    if (!c1) { showStatus('err', 'Concepto 1 obligatorio'); return }
    if (!c2) { showStatus('err', 'Concepto 2 obligatorio'); return }

    const effectiveClienteId = (clienteId === '__none__' || !clienteId) ? null : clienteId
    const customDataStr = serializeCustomData(customValues)

    const body = {
      fecha,
      clienteId: effectiveClienteId,
      c1, c2,
      cant: Number(cant) || 1,
      precioUnitario,
      obs,
      pasadoRegistro: false,
      facturado: false,
      customData: customDataStr,
    }

    if (editingId) {
      await fetch(`${API}/registros/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      showStatus('ok', 'Registro actualizado')
    } else {
      await fetch(`${API}/registros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      showStatus('ok', quickAdd ? 'Registro guardado (modo rápido)' : 'Registro guardado')
    }

    if (quickAdd) {
      // Keep fecha and cliente, reset c1/c2/cant/obs
      setC1('')
      setC2('')
      setCant('1')
      setObs('')
      setCustomValues({})
    } else {
      resetForm()
    }
    loadData()
  }

  async function handlePasarRegistros(ids: string[]) {
    if (ids.length === 0) return
    await fetch(`${API}/registros/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    showStatus('ok', `${ids.length} registro(s) pasado(s) a Registros`)
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar registro?')) return
    await fetch(`${API}/registros/${id}`, { method: 'DELETE' })
    showStatus('ok', 'Registro eliminado')
    loadData()
  }

  function handleEdit(r: Registro) {
    setEditingId(r.id)
    setFecha(r.fecha)
    setClienteId(r.clienteId || '__none__')
    setC1(r.c1)
    setC2(r.c2)
    setCant(String(r.cant))
    setObs(r.obs)
    const cd = parseCustomData(r.customData || '')
    setCustomValues(cd as Record<string, string>)
  }

  const totalEntrada = registros.reduce((sum, r) => {
    const precio = r.precioUnitario > 0 ? r.precioUnitario : precioUnit
    return sum + precio * r.cant
  }, 0)

  // Render custom field input
  function renderCustomFieldInput(field: FieldDef) {
    if (!field.isCustom) return null
    return (
      <div key={field.key}>
        <Label className="text-xs uppercase font-bold text-slate-500">{field.label}</Label>
        <Input
          type={field.type === 'number' ? 'number' : undefined}
          step={field.type === 'number' ? '0.01' : undefined}
          value={customValues[field.key] || ''}
          onChange={e => setCustomValue(field.key, e.target.value)}
          placeholder={field.placeholder || field.label}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Status message */}
      {statusMsg && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mb-3 ${statusMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {statusMsg.type === 'ok' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {statusMsg.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h2 className="text-lg font-bold text-gray-700">{config?.sectionEntrada || 'ENTRADA'}</h2>
        <span className="text-sm text-gray-400 ml-2">{registros.length} pendientes</span>
        <span className="text-sm font-bold text-[#005bb5] ml-auto">
          Total: {totalEntrada.toFixed(2)} {config?.currency || '€'}
        </span>
      </div>

      {/* Form */}
      <div className={`border-l-4 rounded-lg bg-white p-4 shadow-sm mb-3 ${editingId ? 'border-l-indigo-500 bg-indigo-50/30' : 'border-l-transparent'}`}>
        <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_1fr_1fr_80px_1fr_auto] gap-3 items-end">
          {/* Fecha */}
          <div>
            <Label className="text-xs uppercase font-bold text-slate-500">FECHA</Label>
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </div>

          {/* Cliente */}
          <div>
            <Label className="text-xs uppercase font-bold text-slate-500">CLIENTE</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger><SelectValue placeholder="— Sin cliente —" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Sin cliente —</SelectItem>
                {clientes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* C1 - Concepto 1 */}
          <div>
            <Label className="text-xs uppercase font-bold text-slate-500">CONCEPTO 1</Label>
            <ComboInput value={c1} onChange={setC1} suggestions={c1Options} placeholder="Grupo" />
          </div>

          {/* C2 - Concepto 2 */}
          <div>
            <Label className="text-xs uppercase font-bold text-slate-500">CONCEPTO 2</Label>
            <ComboInput value={c2} onChange={setC2} suggestions={c2Options} placeholder="Servicio" />
          </div>

          {/* Cantidad */}
          <div>
            <Label className="text-xs uppercase font-bold text-slate-500">CANT</Label>
            <Input type="number" min="1" value={cant} onChange={e => setCant(e.target.value)} />
          </div>

          {/* Observaciones */}
          <div>
            <Label className="text-xs uppercase font-bold text-slate-500">OBSERVACIONES</Label>
            <Input value={obs} onChange={e => setObs(e.target.value)} placeholder="Observaciones..." />
          </div>

          {/* Save + Quick Add buttons */}
          <div className="flex gap-1">
            <Button onClick={handleSave} className="bg-[#005bb5] hover:bg-[#003d7a] text-white">
              <Save className="h-4 w-4 mr-1" />{editingId ? 'ACT.' : 'GUARDAR'}
            </Button>
            {!editingId && (
              <Button
                onClick={() => setQuickAdd(!quickAdd)}
                variant="outline"
                size="icon"
                title={quickAdd ? 'Modo rápido desactivado' : 'Modo rápido: guarda sin limpiar formulario'}
                className={quickAdd ? 'bg-green-50 border-green-300 text-green-600' : ''}
              >
                <Zap className="h-4 w-4" />
              </Button>
            )}
            {editingId && (
              <Button onClick={resetForm} variant="outline" size="icon">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Custom fields row */}
        {visibleFields.some(f => f.isCustom) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {visibleFields.filter(f => f.isCustom).map(renderCustomFieldInput)}
          </div>
        )}

        {/* Price preview */}
        {precioUnit > 0 && (
          <div className="mt-3 text-sm text-gray-500">
            Precio unitario: <span className="font-bold text-[#005bb5]">{precioUnit.toFixed(2)} {config?.currency || '€'}</span>
            {' · '}Total línea: <span className="font-bold text-green-600">{(precioUnit * (Number(cant) || 1)).toFixed(2)} {config?.currency || '€'}</span>
          </div>
        )}
      </div>

      {/* Registros pendientes table */}
      <div className="flex-1 min-h-0 bg-white rounded-lg border shadow-sm flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr className="bg-green-50">
                <th className="p-2 text-left font-semibold border-b bg-green-50">Fecha</th>
                <th className="p-2 text-left font-semibold border-b bg-green-50">Cliente</th>
                <th className="p-2 text-left font-semibold border-b bg-green-50">C1</th>
                <th className="p-2 text-left font-semibold border-b bg-green-50">C2</th>
                <th className="p-2 text-right font-semibold border-b bg-green-50">Cant</th>
                <th className="p-2 text-right font-semibold border-b bg-green-50">P.Unit</th>
                <th className="p-2 text-right font-semibold border-b bg-green-50">Importe</th>
                <th className="p-2 text-left font-semibold border-b bg-green-50">Obs</th>
                <th className="p-2 text-center font-semibold border-b bg-green-50">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {registros.map(r => {
                const precio = r.precioUnitario > 0 ? r.precioUnitario : precioUnit
                const importe = precio * r.cant
                return (
                  <tr key={r.id} className={`border-b hover:bg-gray-50 ${editingId === r.id ? 'bg-indigo-50' : ''}`}>
                    <td className="p-2">{r.fecha ? r.fecha.split('-').reverse().join('/') : ''}</td>
                    <td className="p-2">{r.cliente || '—'}</td>
                    <td className="p-2">{r.c1}</td>
                    <td className="p-2">{r.c2}</td>
                    <td className="p-2 text-right">{r.cant}</td>
                    <td className="p-2 text-right">{precio.toFixed(2)}</td>
                    <td className="p-2 text-right font-bold text-green-700">{importe.toFixed(2)}</td>
                    <td className="p-2 text-gray-500 text-xs max-w-[120px] truncate">{r.obs}</td>
                    <td className="p-2 text-center">
                      <div className="flex gap-1 justify-center">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-[#005bb5] hover:bg-blue-50" onClick={() => handlePasarRegistros([r.id])} title="Pasar a Registros">
                          <ArrowRightCircle className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-600 hover:bg-indigo-50" onClick={() => handleEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(r.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {registros.length === 0 && (
                <tr><td colSpan={9} className="p-6 text-center text-gray-400">No hay registros pendientes</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bulk actions footer */}
        {registros.length > 0 && (
          <div className="flex-shrink-0 border-t p-3 bg-gray-50 flex items-center justify-between">
            <span className="text-sm text-gray-500">{registros.length} registros pendientes</span>
            <Button
              onClick={() => handlePasarRegistros(registros.map(r => r.id))}
              className="bg-[#2bb24c] hover:bg-[#23963e] text-white"
            >
              <ArrowRightCircle className="h-4 w-4 mr-2" />
              Pasar todo a Registros
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// Zap icon for quick-add mode
function Zap({ className }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}
