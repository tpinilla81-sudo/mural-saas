'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Settings, Building2, Upload, Save, Image as ImageIcon, RotateCcw, CheckCircle, Tag, Eye, EyeOff, GripVertical, ChevronUp, ChevronDown, Plus, X, Trash2 } from 'lucide-react'
import {
  useBillConfig,
  DEFAULT_FIELDS_ENTRADA,
  DEFAULT_FIELDS_CLIENTES,
  DEFAULT_FIELDS_CATALOGO,
  DEFAULT_FIELDS_REGISTROS,
  DEFAULT_FIELDS_FACTURAS,
  type FieldDef,
} from '@/lib/bill-config'

export function ConfiguracionView() {
  const { config, raw, update, reload } = useBillConfig()
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Company form
  const [companyFullName, setCompanyFullName] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyCity, setCompanyCity] = useState('')
  const [companyProvince, setCompanyProvince] = useState('')
  const [companyCif, setCompanyCif] = useState('')
  const [defaultIva, setDefaultIva] = useState(21)
  const [currency, setCurrency] = useState('€')
  const [appName, setAppName] = useState('BILL by Método')

  // Section names
  const [sectionEntrada, setSectionEntrada] = useState('ENTRADA')
  const [sectionRegistros, setSectionRegistros] = useState('REGISTROS')
  const [sectionClientes, setSectionClientes] = useState('CLIENTES')
  const [sectionCatalogo, setSectionCatalogo] = useState('CATÁLOGO')
  const [sectionFacturas, setSectionFacturas] = useState('FACTURAS')

  // Field definitions
  const [fieldsEntrada, setFieldsEntrada] = useState<FieldDef[]>(DEFAULT_FIELDS_ENTRADA)
  const [fieldsClientes, setFieldsClientes] = useState<FieldDef[]>(DEFAULT_FIELDS_CLIENTES)
  const [fieldsCatalogo, setFieldsCatalogo] = useState<FieldDef[]>(DEFAULT_FIELDS_CATALOGO)
  const [fieldsRegistros, setFieldsRegistros] = useState<FieldDef[]>(DEFAULT_FIELDS_REGISTROS)
  const [fieldsFacturas, setFieldsFacturas] = useState<FieldDef[]>(DEFAULT_FIELDS_FACTURAS)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync form from config
  useEffect(() => {
    if (config) {
      setCompanyFullName(config.companyFullName)
      setCompanyAddress(config.companyAddress)
      setCompanyCity(config.companyCity)
      setCompanyProvince(config.companyProvince)
      setCompanyCif(config.companyCif)
      setDefaultIva(config.defaultIva)
      setCurrency(config.currency)
      setAppName(config.appName)
      setSectionEntrada(config.sectionEntrada)
      setSectionRegistros(config.sectionRegistros)
      setSectionClientes(config.sectionClientes)
      setSectionCatalogo(config.sectionCatalogo)
      setSectionFacturas(config.sectionFacturas)
      setFieldsEntrada(config.fieldsEntrada)
      setFieldsClientes(config.fieldsClientes)
      setFieldsCatalogo(config.fieldsCatalogo)
      setFieldsRegistros(config.fieldsRegistros)
      setFieldsFacturas(config.fieldsFacturas)
    }
  }, [config])

  async function handleSave() {
    setSaving(true)
    try {
      await update({
        companyFullName, companyAddress, companyCity, companyProvince, companyCif,
        defaultIva, currency, appName,
        sectionEntrada, sectionRegistros, sectionClientes, sectionCatalogo, sectionFacturas,
        fieldsEntrada: JSON.stringify(fieldsEntrada),
        fieldsClientes: JSON.stringify(fieldsClientes),
        fieldsCatalogo: JSON.stringify(fieldsCatalogo),
        fieldsRegistros: JSON.stringify(fieldsRegistros),
        fieldsFacturas: JSON.stringify(fieldsFacturas),
      })
      setStatusMsg({ type: 'ok', 'text': 'Configuración guardada' })
      setTimeout(() => setStatusMsg(null), 3000)
    } catch (err) {
      setStatusMsg({ type: 'err', text: 'Error al guardar' })
    }
    setSaving(false)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      await update({ logo: base64 })
      setStatusMsg({ type: 'ok', text: 'Logo actualizado' })
      setTimeout(() => setStatusMsg(null), 3000)
    }
    reader.readAsDataURL(file)
  }

  // Field editor component
  function FieldEditor({
    label,
    fields,
    onChange,
  }: {
    label: string
    fields: FieldDef[]
    onChange: (fields: FieldDef[]) => void
  }) {
    function toggleVisibility(index: number) {
      const next = [...fields]
      next[index] = { ...next[index], visible: !next[index].visible }
      onChange(next)
    }

    function updateLabel(index: number, newLabel: string) {
      const next = [...fields]
      next[index] = { ...next[index], label: newLabel }
      onChange(next)
    }

    function moveUp(index: number) {
      if (index === 0) return
      const next = [...fields]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      onChange(next)
    }

    function moveDown(index: number) {
      if (index === fields.length - 1) return
      const next = [...fields]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      onChange(next)
    }

    function addCustomField() {
      const key = `custom_${Date.now()}`
      onChange([...fields, { key, label: 'Nuevo campo', type: 'text', visible: true, isCustom: true, placeholder: '' }])
    }

    function removeField(index: number) {
      const next = [...fields]
      next.splice(index, 1)
      onChange(next)
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-gray-700">{label}</h4>
          <Button size="sm" variant="outline" onClick={addCustomField}>
            <Plus className="h-3 w-3 mr-1" /> Campo personalizado
          </Button>
        </div>
        <div className="space-y-1">
          {fields.map((f, i) => (
            <div key={f.key} className={`flex items-center gap-2 p-2 rounded ${f.isCustom ? 'bg-amber-50' : 'bg-gray-50'}`}>
              <button className="cursor-grab text-gray-400" onClick={() => moveUp(i)}><ChevronUp className="h-3 w-3" /></button>
              <button className="cursor-grab text-gray-400" onClick={() => moveDown(i)}><ChevronDown className="h-3 w-3" /></button>
              <Checkbox checked={f.visible} onCheckedChange={() => toggleVisibility(i)} />
              {f.isCustom && <Tag className="h-3 w-3 text-amber-500" />}
              <Input
                value={f.label}
                onChange={e => updateLabel(i, e.target.value)}
                className="h-8 text-sm flex-1"
              />
              <span className="text-[10px] text-gray-400 uppercase w-16">{f.type}</span>
              {f.isCustom && (
                <Button size="icon" variant="ghost" className="h-6 w-6 text-rose-500" onClick={() => removeField(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Status */}
      {statusMsg && (
        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium mb-3 ${statusMsg.type === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          <CheckCircle className="h-4 w-4" />{statusMsg.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Settings className="h-5 w-5 text-gray-500" />
        <h2 className="text-lg font-bold text-gray-700">Configuración</h2>
        <Button onClick={handleSave} disabled={saving} className="ml-auto bg-[#005bb5] hover:bg-[#003d7a] text-white">
          <Save className="h-4 w-4 mr-1" />{saving ? 'Guardando...' : 'GUARDAR'}
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <Tabs defaultValue="empresa" className="space-y-4">
          <TabsList>
            <TabsTrigger value="empresa">Empresa</TabsTrigger>
            <TabsTrigger value="secciones">Secciones</TabsTrigger>
            <TabsTrigger value="campos">Campos</TabsTrigger>
          </TabsList>

          {/* Empresa tab */}
          <TabsContent value="empresa" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4" />Datos de la Empresa</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><Label className="text-xs uppercase font-bold text-slate-500">Nombre / Razón Social</Label><Input value={companyFullName} onChange={e => setCompanyFullName(e.target.value)} placeholder="Nombre fiscal completo" /></div>
                  <div><Label className="text-xs uppercase font-bold text-slate-500">CIF / NIF</Label><Input value={companyCif} onChange={e => setCompanyCif(e.target.value)} placeholder="B12345678" /></div>
                  <div><Label className="text-xs uppercase font-bold text-slate-500">Dirección</Label><Input value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} placeholder="Calle, número..." /></div>
                  <div><Label className="text-xs uppercase font-bold text-slate-500">Ciudad</Label><Input value={companyCity} onChange={e => setCompanyCity(e.target.value)} /></div>
                  <div><Label className="text-xs uppercase font-bold text-slate-500">Provincia</Label><Input value={companyProvince} onChange={e => setCompanyProvince(e.target.value)} /></div>
                  <div><Label className="text-xs uppercase font-bold text-slate-500">IVA por defecto %</Label><Input type="number" value={defaultIva} onChange={e => setDefaultIva(Number(e.target.value))} /></div>
                  <div><Label className="text-xs uppercase font-bold text-slate-500">Moneda</Label><Input value={currency} onChange={e => setCurrency(e.target.value)} /></div>
                  <div><Label className="text-xs uppercase font-bold text-slate-500">Nombre de la app</Label><Input value={appName} onChange={e => setAppName(e.target.value)} /></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ImageIcon className="h-4 w-4" />Logo</CardTitle></CardHeader>
              <CardContent>
                {config?.logo && (
                  <div className="mb-3">
                    <img src={config.logo.startsWith('data:') ? config.logo : `data:image/png;base64,${config.logo}`} alt="Logo" className="max-h-20 object-contain border rounded p-1" />
                  </div>
                )}
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> Subir logo
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Secciones tab */}
          <TabsContent value="secciones" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Tag className="h-4 w-4" />Nombres de Secciones</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div><Label className="text-xs uppercase font-bold text-slate-500">Entrada</Label><Input value={sectionEntrada} onChange={e => setSectionEntrada(e.target.value)} /></div>
                  <div><Label className="text-xs uppercase font-bold text-slate-500">Registros</Label><Input value={sectionRegistros} onChange={e => setSectionRegistros(e.target.value)} /></div>
                  <div><Label className="text-xs uppercase font-bold text-slate-500">Clientes</Label><Input value={sectionClientes} onChange={e => setSectionClientes(e.target.value)} /></div>
                  <div><Label className="text-xs uppercase font-bold text-slate-500">Catálogo</Label><Input value={sectionCatalogo} onChange={e => setSectionCatalogo(e.target.value)} /></div>
                  <div><Label className="text-xs uppercase font-bold text-slate-500">Facturas</Label><Input value={sectionFacturas} onChange={e => setSectionFacturas(e.target.value)} /></div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campos tab */}
          <TabsContent value="campos" className="space-y-4">
            <Card>
              <CardContent className="space-y-6 pt-4">
                <FieldEditor label="Entrada — Campos" fields={fieldsEntrada} onChange={setFieldsEntrada} />
                <Separator />
                <FieldEditor label="Clientes — Campos" fields={fieldsClientes} onChange={setFieldsClientes} />
                <Separator />
                <FieldEditor label="Catálogo — Campos" fields={fieldsCatalogo} onChange={setFieldsCatalogo} />
                <Separator />
                <FieldEditor label="Registros — Campos" fields={fieldsRegistros} onChange={setFieldsRegistros} />
                <Separator />
                <FieldEditor label="Facturas — Campos" fields={fieldsFacturas} onChange={setFieldsFacturas} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
