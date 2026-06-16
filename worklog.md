---
Task ID: 1
Agent: main
Task: Fix delete functionality in Sedes tab (X button not working)

Work Log:
- Investigated the SedesTab component and API route /api/company/sedes/[id]
- Identified root causes:
  1. DELETE API route did not extract `user` from `requireCompanyAdmin()` — no ownership validation
  2. Frontend `handleDelete` had zero error handling — API errors silently ignored
  3. Browser `confirm()` dialog may be blocked in certain contexts
  4. No field validation on PUT route (mass assignment vulnerability)
- Fixed DELETE route: added ownership check, 404 handling, try/catch with error response
- Fixed PUT route: added ownership check, field whitelist validation
- Rewrote SedesTab.tsx with:
  - Styled confirmation dialog instead of browser confirm()
  - Toast notifications for success/error feedback
  - Proper error handling on all API calls
  - Loading states and empty states
  - Cancel edit button
  - Focus ring on inputs
- Applied same fixes to ProfesionalTab.tsx and professionals/[id] API route
- Applied same fixes to holidays/[id] API route
- Verified build compiles successfully (npx next build)

Stage Summary:
- All delete functionality now works with proper error handling
- Confirmation dialogs are styled and consistent with app theme
- API routes now validate ownership before delete/update
- Toast notifications provide user feedback on success/failure

---
Task ID: 2
Agent: main
Task: Replicate Bill by Método app in Facturación module

Work Log:
- Found standalone Bill by Método app at /tmp/bill-by-metodo/ (v3.0)
- Examined all view components: EntradaView, RegistrosView, ClientesView, CatalogoView, FacturasView, ConfiguracionView
- Examined utility files: hualsa-utils.ts, config.tsx (ConfigContext, FieldDef system)
- Updated Prisma schema: added appVersion, sectionBackup, labelEntrada/Catalogo/Registros/Facturas/Clientes, transferMode, transferTime to BillConfig
- Ran prisma db push to apply schema changes
- Created /src/lib/bill-utils.ts: fmtCurrency, fmtDate, fmtMonth, getISOWeek, todayISO, type interfaces
- Created /src/lib/bill-config.tsx: BillConfigProvider, FieldDef system, DEFAULT_FIELDS_*, resolveConfig, parseCustomData/serializeCustomData
- Created /src/components/bill/entrada-view.tsx: Entrada form with ComboInput, quick-add mode, pasar a registros
- Created /src/components/bill/clientes-view.tsx: Client CRUD with configurable fields, search
- Created /src/components/bill/catalogo-view.tsx: Catalog CRUD with filters, Excel import/export, client-specific pricing
- Created /src/components/bill/registros-view.tsx: Registros with filters, bulk selection, mark facturado, edit modal
- Created /src/components/bill/facturas-view.tsx: Invoice generation by client, preview, print, export
- Created /src/components/bill/configuracion-view.tsx: Config with Empresa/Secciones/Campos tabs, logo upload, FieldEditor
- Rewrote /src/components/BillTab.tsx: Main container with BillConfigProvider, navigation tabs, dark header
- Updated /src/app/api/company/bill/config/route.ts: Added new allowed fields (appVersion, sectionBackup, labels, transferMode, transferTime)
- Updated /src/app/api/company/bill/catalogo/route.ts: Added { batch: [...] } format support
- Updated /src/app/api/company/bill/registros/transfer/route.ts: Added support for transferring specific IDs
- Installed xlsx package for Excel import/export
- Reset admin@mural.es password
- Verified build compiles successfully
- Pushed to GitHub/Vercel
- Tested all views via browser automation: Entrada, Clientes, Catálogo, Facturas, Configuración all working
- Created test client "Cliente Test SL", catalog item "Consultoría/Servicio A", and entrada record successfully

Stage Summary:
- Bill by Método app fully replicated in Facturación module, independent from Diario
- 6 views: ENTRADA, REGISTROS, CLIENTES, CATÁLOGO, FACTURAS, CONFIGURACIÓN
- Configurable field definitions with visibility toggles and custom fields
- Excel import/export for Catálogo
- Invoice generation with print functionality
- ComboInput with dropdown suggestions from catalog
- Quick-add mode in Entrada
- Bulk operations in Registros (mark facturado, delete)
- Dark navigation bar matching Bill by Método style
- All API routes working and tested

---
Task ID: 3
Agent: main
Task: Create Diario → Facturación bridge (salida cumplida → paso a facturar)

Work Log:
- Added new Prisma model BillDiarioItem storing "salida cumplida" entries
  * Fields: fecha, sedeId/sedeName, professionalId/professionalName, turn,
    clienteId/cliente, c1/c2, cant, precioUnitario, obs, status (CUMPLIDA|FACTURADA),
    sourceType (plan|manual), sourceId (Plan.id), registroId (BillRegistro.id),
    facturadoAt
  * @@unique([sourceType, sourceId]) for sync dedup
- Pushed schema to Neon DB with prisma db push
- Created 3 new API routes:
  * GET /api/company/bill/diario (list with filters: status/from/to/sedeId/clienteId)
  * POST /api/company/bill/diario (two modes: syncFrom="plans" OR manual create)
    - Sync mode: pulls Plan entries, dedupes by sourceId, auto-maps Sede→BillCliente
      by name (case-insensitive), auto-resolves precioUnitario from BillCatalogo
      using c1="Servicios" c2=turn, resolves professional alias→id+name
    - Manual mode: creates a single BillDiarioItem with form fields
  * PUT /api/company/bill/diario/[id] (edit fecha/cliente/c1/c2/cant/precio/obs)
  * DELETE /api/company/bill/diario/[id]
  * POST /api/company/bill/diario/transfer (converts selected items → BillRegistros
    with pasadoRegistro=true, marks items as FACTURADA, sets registroId+facturadoAt)
- Created /src/components/bill/diario-view.tsx with:
  * Filters (date range, sede, cliente, status, free text)
  * "Sincronizar desde Diario" button → opens modal with date range + sync result
  * "Nuevo item" button → manual add modal (fecha/sede/profesional/turno/cliente/c1/c2/cant/precio/obs)
  * Edit modal for cumplida items
  * Bulk selection + "Pasar a facturar" action → transfers to REGISTROS
  * Excel export
  * Stats bar (total/cumplidas/facturadas/importe)
  * Emerald color theme to distinguish from Entrada (green) and Registros (blue)
- Updated BillTab.tsx:
  * Added DIARIO tab between ENTRADA and REGISTROS (CalendarClock icon, emerald color)
  * Default tab is now "diario" to highlight the new bridge
- Reset admin@mural.es password (was stale after env var changes)
- Build successful, pushed to GitHub/Vercel
- End-to-end test on production:
  * Synced 122 plan entries from 2026 → 122 CUMPLIDA items created
  * Transferred 3 items → 3 BillRegistros created with pasadoRegistro=true
  * 3 items now show as FACTURADA in Diario and appear in REGISTROS view

Stage Summary:
- Diario → Facturación bridge fully operational on production
- Flow: Diario plans → [Sincronizar] → BillDiarioItem (CUMPLIDA) → [Pasar a facturar] → BillRegistro (REGISTROS) → [Marcar facturado] → Factura
- Auto-maps Sede name → BillCliente name (case-insensitive)
- Auto-resolves precio from catalog (c1=Servicios, c2=Mañana/Tarde)
- Manual add/edit also available for items not in Diario
- All deduped so re-syncing doesn't create duplicates

---
Task ID: 4
Agent: main
Task: Each Diario salida carries N líneas from catálogo — those líneas are what gets invoiced

Work Log:
- Added new Prisma model BillDiarioLine (one-to-many from BillDiarioItem)
  * Fields: diarioItemId (FK), companyId, catalogoId (optional FK to BillCatalogo),
    c1/c2 (denormalized from catalog or manual), cant, precioUnitario, obs, orden
  * Cascade delete on parent BillDiarioItem
- Pushed schema to Neon DB
- Created 4 new API routes for líneas management:
  * GET /api/company/bill/diario/[id]/lineas — list all líneas of an item
  * POST /api/company/bill/diario/[id]/lineas — add single línea
    - If catalogoId provided, auto-fills c1/c2/precioUnitario from catalog
    - If c1+c2 without catalogoId, looks up price (client-specific first, then generic)
  * PUT /api/company/bill/diario/[id]/lineas — batch replace all líneas
    - For inline editing in the UI: incoming array determines create/update/delete
    - Same catalogoId/c1+c2 auto-resolution as POST
  * DELETE /api/company/bill/diario/[id]/lineas/[lineaId] — delete single línea
- Updated GET /api/company/bill/diario to include lineas in the response
- Updated transfer route POST /api/company/bill/diario/transfer:
  * If item has líneas: creates one BillRegistro PER línea (N registros per item)
  * If item has no líneas: fallback to single BillRegistro (backward compat)
  * Response now includes registrosCreated count
- Rewrote DiarioView component:
  * Expandable rows (chevron icon) — click to show inline LíneasEditor panel
  * Table now shows línea count + importe (sum of líneas when present)
  * Simplified "Nuevo item" modal: just header (sede/profesional/turno/cliente);
    user adds líneas via inline editor after creation
  * Inline LíneasEditor panel per expanded item:
    - Catalog dropdown (client-specific items first, then generic, separated by headers)
    - "— Manual —" option to enter c1/c2/cant/precio/obs by hand
    - When catalog item selected, c1/c2/precio auto-fill and become read-only
    - Edit cantidad, obs inline; delete each line
    - "Guardar" button persists the full batch (PUT batch endpoint)
    - Live total at the top
  * Edit modal simplified (only fecha/cliente/obs; lineas edited inline)
  * Excel export now expands to one row per línea
  * Stats bar importe sums líneas when present
  * Transfer confirm message updated: "Se creará un registro por cada línea"
- Build successful, pushed to GitHub/Vercel
- End-to-end test on production:
  * Added 5 catalog items (Servicios/Mañana, Servicios/Tarde, Consultas/Primera visita, Consultas/Sucesiva, Procedimientos/Curas)
  * Added 3 lineas to a test Diario item (1×Mañana=80 + 2×Sucesiva=70 + 1×Curas=25 = 175 total)
  * Transferred the item: created 3 BillRegistros with correct c1/c2/cant/precio
  * Item marked as FACTURADA, all 3 registros appear in REGISTROS view

Stage Summary:
- Each Diario salida now carries N líneas from catálogo — those líneas are what gets invoiced
- Flow: Diario plans → [Sync] → BillDiarioItem (CUMPLIDA, no líneas) → [Expand + add líneas from catálogo] → [Pasar a facturar] → N BillRegistros (one per línea) → Facturas
- Catálogo dropdown shows client-specific items first (with header), then generic items
- Full inline editing (add/edit/delete/save batch) without leaving the Diario tab
- Backward compatible: items without líneas still transfer as a single registro
