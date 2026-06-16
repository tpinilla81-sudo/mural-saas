'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Pencil, Trash2, Save, RotateCcw } from 'lucide-react'
import type { Cliente } from '@/lib/bill-utils'
import { useBillConfig, DEFAULT_FIELDS_CLIENTES, type FieldDef, parseCustomData, serializeCustomData } from '@/lib/bill-config'

const API = '/api/company/bill'

export function ClientesView() {
  const { config } = useBillConfig()
  const fieldDefs = config?.fieldsClientes || DEFAULT_FIELDS_CLIENTES
  const visibleFields = fieldDefs.filter(f => f.visible)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)

  // Core field state
  const [nombre, setNombre] = useState('')
  const [cif, setCif] = useState('')
  const [mail, setMail] = useState('')
  const [tel, setTel] = useState('')
  const [dir, setDir] = useState('')
  const [cp, setCp] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [prov, setProv] = useState('')

  // Custom fields state
  const [customValues, setCustomValues] = useState<Record<string, string>>({})

  const [searchQ, setSearchQ] = useState('')

  const loadData = useCallback(async () => {
    const res = await fetch(`${API}/clientes`)
    const data = await res.json()
    setClientes(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function resetForm() {
    setEditingId(null)
    setNombre(''); setCif(''); setMail(''); setTel('')
    setDir(''); setCp(''); setCiudad(''); setProv('')
    setCustomValues({})
  }

  function setCustomValue(key: string, value: string) {
    setCustomValues(prev => ({ ...prev, [key]: value }))
  }

  function getCoreValue(key: string): string {
    switch (key) {
      case 'nombre': return nombre
      case 'cif': return cif
      case 'direccion': return dir
      case 'cp': return cp
      case 'ciudad': return ciudad
      case 'provincia': return prov
      case 'mail': return mail
      case 'telefono': return tel
      default: return ''
    }
  }

  function setCoreValue(key: string, value: string) {
    switch (key) {
      case 'nombre': setNombre(value); break
      case 'cif': setCif(value); break
      case 'direccion': setDir(value); break
      case 'cp': setCp(value); break
      case 'ciudad': setCiudad(value); break
      case 'provincia': setProv(value); break
      case 'mail': setMail(value); break
      case 'telefono': setTel(value); break
    }
  }

  async function handleSave() {
    if (!nombre) { alert('Nombre obligatorio'); return }
    const customDataStr = serializeCustomData(customValues)
    const body = { nombre, cif, mail, tel, dir, cp, ciudad, prov, customData: customDataStr }
    if (editingId) {
      await fetch(`${API}/clientes/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      await fetch(`${API}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
    resetForm()
    loadData()
  }

  function handleEdit(c: Cliente) {
    setEditingId(c.id)
    setNombre(c.nombre); setCif(c.cif); setMail(c.mail); setTel(c.tel)
    setDir(c.dir); setCp(c.cp); setCiudad(c.ciudad); setProv(c.prov)
    const cd = parseCustomData(c.customData || '')
    setCustomValues(cd as Record<string, string>)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar cliente?')) return
    await fetch(`${API}/clientes/${id}`, { method: 'DELETE' })
    loadData()
  }

  function getDisplayValue(c: Cliente, field: FieldDef): string {
    if (field.isCustom) {
      const cd = parseCustomData(c.customData || '')
      return String(cd[field.key] || '')
    }
    switch (field.key) {
      case 'nombre': return c.nombre
      case 'cif': return c.cif
      case 'direccion': return c.dir
      case 'cp': return c.cp
      case 'ciudad': return c.ciudad
      case 'provincia': return c.prov
      case 'mail': return c.mail
      case 'telefono': return c.tel
      default: return ''
    }
  }

  function renderFieldInput(field: FieldDef) {
    const value = field.isCustom ? (customValues[field.key] || '') : getCoreValue(field.key)
    const onChange = field.isCustom
      ? (e: React.ChangeEvent<HTMLInputElement>) => setCustomValue(field.key, e.target.value)
      : (e: React.ChangeEvent<HTMLInputElement>) => setCoreValue(field.key, e.target.value)

    return (
      <div key={field.key}>
        <Label className="text-xs uppercase font-bold text-slate-500">{field.label}{field.required ? ' *' : ''}</Label>
        <Input
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          step={field.type === 'number' ? '0.01' : undefined}
          value={value}
          onChange={onChange}
          placeholder={field.placeholder || field.label}
        />
      </div>
    )
  }

  const filteredClientes = searchQ
    ? clientes.filter(c => c.nombre.toLowerCase().includes(searchQ.toLowerCase()) || c.cif.toLowerCase().includes(searchQ.toLowerCase()) || c.mail.toLowerCase().includes(searchQ.toLowerCase()))
    : clientes

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <h2 className="text-lg font-bold text-gray-700">Clientes</h2>
        <span className="text-sm text-gray-400 ml-2">{clientes.length} clientes</span>
        <div className="ml-auto">
          <Input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Buscar..."
            className="w-48"
          />
        </div>
      </div>

      {/* Form */}
      <Card className={`border-l-4 ${editingId ? 'border-l-indigo-500 bg-indigo-50/30' : 'border-l-transparent'} mb-3`}>
        <CardContent className="p-4">
          <div className="grid gap-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {visibleFields.filter(f => !f.isCustom).slice(0, 4).map(renderFieldInput)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_150px] gap-3">
              {visibleFields.filter((f, i) => !f.isCustom && i >= 4).map(renderFieldInput)}
              {visibleFields.filter(f => f.isCustom).map(renderFieldInput)}
              <div className="flex gap-2 items-end">
                <Button onClick={handleSave} className="bg-[#005bb5] hover:bg-[#003d7a] text-white flex-1">
                  <Save className="h-4 w-4 mr-1" />{editingId ? 'ACTUALIZAR' : 'GUARDAR'}
                </Button>
                {editingId && (
                  <Button onClick={resetForm} variant="outline" size="icon">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="flex-1 min-h-0 bg-white rounded-lg border shadow-sm flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="sticky top-0 z-10 shadow-sm">
              <tr className="bg-green-50">
                {visibleFields.map(f => (
                  <th key={f.key} className="p-2 text-left font-semibold border-b bg-green-50">{f.label}</th>
                ))}
                <th className="p-2 text-left font-semibold border-b bg-green-50">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {filteredClientes.map(c => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  {visibleFields.map(f => (
                    <td key={f.key} className="p-2">{getDisplayValue(c, f)}</td>
                  ))}
                  <td className="p-2">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-600 hover:bg-indigo-50" onClick={() => handleEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:bg-rose-50" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredClientes.length === 0 && (
                <tr><td colSpan={visibleFields.length + 1} className="p-6 text-center text-gray-400">No hay clientes</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
