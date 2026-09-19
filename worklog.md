---
Task ID: 8
Agent: main
Task: Passwordless login — "Entrar como:" picker with all users (no password)

Work Log:
- User asked: "quita las contraseñas, en el login pon un selector entrar como: y un listado superadministrado y los qeu haya creado pero sin contraseña"
- Modified src/lib/auth.ts:
  * Removed bcrypt import (no longer needed)
  * Removed `password` credential from CredentialsProvider
  * authorize() now just looks up the user by email and returns the session user (no bcrypt.compare)
  * Kept isActive check (so disabled users still can't log in)
  * Kept try/catch from remote rebase
- Created new public endpoint /api/auth/login-users/route.ts:
  * GET returns all active users: { id, email, name, role, companyName }
  * Public (no auth required) — used by login page to populate the picker
  * Ordered by role (SUPER_ADMIN first) then by name
- Rewrote src/components/LoginForm.tsx:
  * Removed email/password inputs and useState for password
  * Fetches /api/auth/login-users on mount
  * Shows a multi-line <select> with optgroups:
    - "Super Admin" group lists SUPER_ADMIN users
    - "Usuarios de Empresa" group lists COMPANY_ADMIN/USER with company name
  * Single "Entrar" button — calls signIn with just { email }
  * Loading state for the user list, error state, no-password-required UX
- Updated src/app/api/company/users/route.ts:
  * Password no longer required in POST body
  * If password provided: hash it as before
  * If not: generate a random string, hash it, store (DB column is NOT NULL but auth never reads it)
- Updated src/app/api/auth/register/route.ts:
  * Same password-optional logic
- Updated src/components/CompanyProfileTab.tsx:
  * User form no longer has a password field
  * createUser() validation: only name + email required
  * userForm state type updated to { name, email, role }
- Resolved git rebase conflict in src/lib/auth.ts (combined HEAD's try/catch with our passwordless return)
- Build successful, pushed to Vercel (commit e0fd1c3)
- Verified on production:
  * GET /api/auth/login-users returns 3 users (admin@mural.es, mural@mural.app, juliomurillozardoya@gmail.com)
  * POST /api/auth/callback/credentials with only email field → session token issued for all 3
  * Nonexistent email → no session (correctly rejected)

Stage Summary:
- Login is now passwordless: a single dropdown "Entrar como:" shows all active users
- SUPER_ADMIN users grouped separately at top of the list
- Company users shown with role + company name
- Click any user → "Entrar" → logged in
- Creating new users from CompanyProfileTab no longer requires a password
- Backward compat: existing password hashes in DB are simply ignored (kept as a safety net)

---
Task ID: 9
Agent: main
Task: Diario — quitar colores por motivo de aviso (BAJA/FORMACION/PERMISO/VACACIONES) y eliminar el resumen superior

Work Log:
- User: "los colres de baja, vacaciones...et no tienen sentido, quitalos. los rresumenes tampoco en diario"
- Editado src/components/DiarioTab.tsx:
  * getAvisoColor(): antes devolvía 4 colores distintos según el motivo (BAJA=red, FORMACION=blue, PERMISO=yellow, VACACIONES=orange); ahora devuelve siempre el mismo rojo uniforme (bg-red-700/70). Parámetro renombrado a _reason para indicar que no se usa.
  * Leyenda desktop: eliminadas las 4 entradas Baja/Formación/Permiso/Vacaciones. Solo se conservan Finde y Festivo (que sí son informativas: identificación visual de celdas de fin de semana y festivos).
  * Leyenda móvil: eliminadas las 4 entradas B/F/P/V. Solo WE/Fest.
  * Eliminada por completo la barra "Resumen {year}:" con conteos por profesional (M/T/Σ/!) que aparecía entre la toolbar y la tabla.
- Se conservan las etiquetas cortas BAJ/FOR/PER/VAC dentro de las celdas (getAvisoLabel), para que el motivo siga siendo identificable sin usar color.
- Se conserva proCounts en JS porque sigue usándose para mostrar el contador junto a cada profesional en el dropdown "VER PROFESIONALES".
- Confirmado: ningún otro componente usa avisos con colores (verificado con rg en src/components).
- Build: los únicos errores son pre-existentes (módulo 'xlsx' no instalado en bill-views); DiarioTab compila limpio.
- Commit b4a5f0e, pushed a origin/main.

Stage Summary:
- En la vista Diaria, todos los avisos ahora se ven del mismo color (rojo oscuro), sin distinción por motivo.
- La leyenda solo muestra Finde y Festivo (que son marcas del calendario, no de aviso).
- La barra de resumen superior ha desaparecido — la tabla ahora ocupa ese espacio.

---
Task ID: 10
Agent: main
Task: Diario — quitar todos los filtros excepto los círculos de color de sede

Work Log:
- User: "quitar filtros en diario, solo dejar poder filtrar por sedes con los circulos de colores"
- Editado src/components/DiarioTab.tsx (eliminadas 137 líneas, añadidas 6):
  * Estado eliminado: filterPro, filterCity, filterProvince, filterAvisoReason, showFilters
  * Funciones eliminadas: clearAllFilters, hasAnyFilter, hasAvisoReasonMatch, hasProInRow, uniqueCities, uniqueProvinces
  * filteredSedes simplificado: solo aplica filterColors
  * Botón "🔍 Filtros" eliminado del toolbar
  * Panel "Filter Bar" completo eliminado (el bloque {showFilters && (...)} con todos los dropdowns)
  * En el grid: eliminadas proMatchM/proMatchT, reasonMatch, dimReason; dimCell ahora solo depende de visMatch
  * Conservados: dropdown "VER PROFESIONALES" (es visibilidad, no filtro de filas) y selector "ASIGNAR PRO" (es para asignar, no para filtrar)
  * Conservada la fila de círculos de color siempre visible con su "✕ Limpiar"
- tsc --noEmit limpio para DiarioTab
- Commit 01ffca8, pushed a origin/main

Stage Summary:
- En la vista Diaria solo queda un filtro visible: los círculos de color de sede (multiselección, siempre presentes bajo el toolbar).
- El resto de filtros (Profesional/Ciudad/Provincia/Aviso) y el botón Filtros han desaparecido por completo.

---
Task ID: 11
Agent: main
Task: Eliminar el módulo de facturación (pestaña FACTURACIÓN y todo su código)

Work Log:
- User: "quita el modulo de facturacion, no lo necestamos al final"
- Editado src/components/CompanyDashboard.tsx:
  * Eliminado el import BillTab
  * Eliminada la pestaña "facturacion" del tipo MainTab y del array mainTabs
  * Eliminado el render condicional {tab === "facturacion" && <BillTab />}
- Editado src/app/layout.tsx: description ahora "Plataforma de gestión de turnos profesional" (sin "y facturación")
- Borrados físicamente:
  * src/components/BillTab.tsx
  * src/components/bill/ (7 vistas: entrada-view, diario-view, registros-view, clientes-view, catalogo-view, facturas-view, configuracion-view)
  * src/lib/bill-config.tsx (BillConfigProvider)
  * src/lib/bill-utils.ts
  * src/app/api/company/bill/ (toda la carpeta: catalogo, clientes, config, diario, factura-seq, registros con sus sub-rutas)
- Schema de Prisma NO tocado: los modelos Bill* (BillCliente, BillCatalogo, BillRegistro, BillDiarioItem, BillDiarioLine, BillConfig, BillFacturaSeq) siguen en schema.prisma y en DB, pero ya no se referencian desde la app. Si se quiere limpiar DB, hacer migración aparte.
- Conservados /api/company/billing y /api/company/invoices: son del módulo de SUSCRIPCIÓN SaaS (pagos de la empresa a Mural), no de facturación a clientes. Se confirman usados en SuperAdminDashboard y CompanyProfileTab (billingMethod, planName, price).
- Commit ec9a131. En ese commit se coló por error .env (con credenciales de Neon) — corregido en commit 5f6ba80 que hace git rm --cached .env. El .env sigue en el working tree para uso local/producción pero ya no se trackea. (Ya estaba en .gitignore, pero al haber sido trackeado antes, el cached override se mantuvo.)
- tsc --noEmit limpio para los archivos modificados (CompanyDashboard, layout). Los errores restantes son pre-existentes (schema.prisma desactualizado en otros módulos).

Stage Summary:
- La pestaña FACTURACIÓN ya no aparece en el menú principal de la empresa.
- Toda la UI y la API de facturación a clientes se han eliminado del código.
- Los modelos de DB siguen existiendo (sin uso) — no se ha alterado la DB.
- .env des-trackeado para evitar exposición futura de credenciales.

---
Task ID: 12
Agent: main
Task: Crear módulo de configuración de permisos para que los profesionales puedan entrar a ver cosas

Work Log:
- User: "LKO QUE SI QUE VAMOS HACER EN UN MODULO DE CONFIGURACION CON PERMISOS PARA DAR A LOPROFESIONALES ESTOS PERMISOS Y QEU PUEDAN ENTRAR A VER COSAS"
- Schema: añadidos 2 campos a User (model en prisma/schema.prisma):
  * professionalId String?  → link al Professional cuando este User es su login
  * permissions String @default("")  → CSV con claves: view_diario, view_mensual, view_own_only, view_assigned_sedes
- DB sync: `npx prisma db push --skip-generate` (7.74s OK) + `npx prisma generate` (Prisma client v6.19.2)
- API nueva: src/app/api/company/permissions/route.ts
  * GET: lista todos los profesionales de la empresa con su User asociado (vía professionalId o email fallback) y permisos parseados
  * PUT: { professionalId, canLogin, view_diario, view_mensual, view_own_only, view_assigned_sedes }
    - canLogin=true → crea o reactiva un User (role=USER, email=pro.email, professionalId=pro.id, password=random)
    - canLogin=false → desactiva el User (no borra)
    - Comprueba colisión de email; requiere email válido en el profesional
    - Requiere COMPANY_ADMIN o SUPER_ADMIN
- Auth: src/lib/auth.ts
  * authorize() ahora devuelve professionalId + permissions (cast `as any` para sortear tipo User estricto de next-auth)
  * callbacks jwt/session propagan professionalId y permissions al token y a session.user
- api-auth.ts: SessionUser ampliado con professionalId? y permissions?
- UI: src/components/CompanyProfileTab.tsx
  * Nueva sección "Permisos" junto a Datos y Usuarios
  * Tabla desktop + tarjetas móvil con 5 checkboxes por profesional:
    1. Puede entrar (canLogin)
    2. Ver diario
    3. Ver mensual
    4. Solo sus turnos
    5. Solo sus sedes
  * Checkboxes 2-5 deshabilitados si canLogin=false; canLogin deshabilitado si pro no tiene email
  * Actualización optimista + sync servidor + toasts
  * Carga bajo demanda al entrar a la sección (useEffect)
- Bug pre-existente arreglado: deleteUser(u) → deleteUser(u.id) en 2 sitios (mobile + desktop)
- UserView: src/components/UserView.tsx (reescrito)
  * Lee session.user.permissions y professionalId
  * Carga el Professional vinculado (vía /api/company/professionals) para saber alias y assignedSedes
  * Filtra planes según view_own_only (alias match) y view_assigned_sedes (sede in assignedSedes CSV)
  * Si tiene ambos view_diario + view_mensual → toggle para cambiar entre vista Mensual (calendario) y Diario (tabla sedes×días, solo lectura)
  * Vista Diario también filtra las sedes visibles (solo las asignadas)
  * Saluda al pro por alias arriba a la derecha
- tsc --noEmit limpio en todos los archivos tocados
- next build: ✓ Compiled successfully in 3.6s; ruta /api/company/permissions generada como dynamic f
- Commit d252a1a, pushed a origin/main

Stage Summary:
- El COMPANY_ADMIN entra en "Mi Empresa → Permisos" y ve todos sus profesionales.
- Marca "Puede entrar" en un profesional → se crea automáticamente un User (role=USER) con su email → aparece en el selector passwordless del login.
- El admin elige qué puede ver ese profesional: diario, mensual, y si ve todo o solo sus turnos/sedes.
- El profesional entra con su email (sin contraseña) y ve una vista filtrada:
  * Mensual: calendario con solo sus asignaciones (o todas si no tiene filtros)
  * Diario: tabla sedes×días de solo lectura, solo de sus sedes si aplica
- En producción hay que rotar credenciales de Neon y NEXTAUTH_SECRET (commit anterior expuso .env).

---
Task ID: 13
Agent: main
Task: Módulo Configuración con permisos granulares + login con contraseña por profesional

Work Log:
- User: "los perison tieien qeu ser , ver y manejar su diario, ver y manejar sus sedes, , lo mismo con mensual,poder imprimirr, enviar...etc.eso por profesional, habra qeu darles un usuario y contraseña qeu tambien gestiona en configuracion"
- Catálogo de permisos ampliado de 4 a 10 claves en User.permissions (String CSV, sin migración):
  * view_diario, edit_diario
  * view_mensual, edit_mensual
  * view_sedes, edit_sedes
  * view_own_only, view_assigned_sedes (pre-existentes)
  * can_print, can_send (nuevos)
- API src/app/api/company/permissions/route.ts reescrito:
  * GET ahora devuelve hasPassword (booleano derivado del length del hash) en el objeto user
  * PUT acepta body completo: { professionalId, canLogin, email, password, view_diario, edit_diario, view_mensual, edit_mensual, view_sedes, edit_sedes, view_own_only, view_assigned_sedes, can_print, can_send }
  * Si password viene no vacío y >= 4 chars → bcrypt hash + guarda en user.password
  * Si canLogin=true y no existe User → lo crea (con la contraseña hasheada o un random si no se proveyó)
  * Si canLogin=true y existe User → actualiza email, password (si vino), perms
  * Si canLogin=false → desactiva el User (isActive=false)
  * Sync del email también al registro Professional
  * PERM_KEYS exportado para reutilización
- src/lib/auth.ts: reactivado flujo con contraseña
  * CredentialsProvider ahora pide email + password
  * authorize(): lookup user por email, check isActive, check que user.password sea un hash real (length>20, evita aceptar placeholders legacy), bcrypt.compare(password, user.password)
  * Devuelve same session user (role, companyId, professionalId, permissions)
- src/components/LoginForm.tsx: añadido campo contraseña
  * Mantiene el selector de usuario (autocomplete el email)
  * Input password con botón VER/OCULTAR
  * signIn("credentials", { email, password, redirect: false })
  * Validación: sin contraseña → error "Introduce la contraseña"
- src/components/ConfigTab.tsx (NUEVO, ~430 líneas):
  * Lista colapsable de profesionales (load from /api/company/permissions)
  * Cada fila muestra: avatar (iniciales), nombre + alias, badge ACCESO ACTIVO/SIN ACCESO, email, indicador "con contraseña", contador de permisos activos
  * Click expande → panel con:
    - Checkbox "Puede iniciar sesión"
    - Input Email (usuario)
    - Input Contraseña (placeholder cambia según hasPassword: "Dejar vacío para mantener" vs "Mínimo 4 caracteres")
    - Grid de 10 permisos agrupados en 5 cards: Diario / Mensual / Sedes / Filtros / Acciones
    - Cada permiso tiene label + help tooltip
    - Cascada automática: marcar edit_X activa view_X; desmarcar view_X desactiva edit_X
    - Perms deshabilitados si canLogin=false
    - Botón Guardar (sólo habilitado si dirty)
  * Toast de éxito/error
  * Footer con conteo de activos
- src/components/CompanyDashboard.tsx:
  * Añadido import ConfigTab
  * type MainTab ahora "empresa" | "diario" | "config"
  * mainTabs array incluye { key: "config", label: "CONFIGURACIÓN", icon: "⚙️" }
  * Render condicional {tab === "config" && <ConfigTab />}
- src/components/UserView.tsx:
  * type Perms extendido a las 10 claves
  * parsePerms() actualizado
  * handlePrint() → window.print() con título dinámico (Diario/Mensual - MES AÑO)
  * handleSend() → mailto: con subject y body pre-rellenados (resumen del periodo, total de turnos, sedes asignadas)
  * Topbar: botones 🖨️ Imprimir (si can_print) y ✉️ Enviar (si can_send) — ocultos en móvil el label
  * Banner verde "Tienes permiso de edición para esta vista" cuando edit_diario/edit_mensual está activo en la vista correspondiente (placeholder para futura edición inline)
- prisma/schema.prisma: solo actualizado el comentario del campo User.permissions para listar las 10 claves (la columna ya era String CSV, no requiere migración)
- tsc --noEmit: limpio en todos los archivos tocados. Los errores restantes son pre-existentes (facturación eliminada, scripts migrate, examples).
- next build: ✓ Compiled successfully in 3.5s
- Commit a1ce6d3, pushed a origin/main

Stage Summary:
- El COMPANY_ADMIN entra a "Configuración" (nueva pestaña ⚙️) y ve todos sus profesionales.
- Por cada profesional puede: activar/desactivar acceso, asignar email + contraseña, y marcar granularmente qué puede ver/editar (diario, mensual, sedes) + si puede imprimir/enviar.
- El login ahora pide contraseña real (bcrypt hasheado en DB). Los usuarios existentes que no tengan hash real (placeholders legacy) son rechazados hasta que el admin les asigne una desde Configuración.
- El profesional logueado ve botones Imprimir (window.print) y Enviar (mailto pre-rellenado) según sus permisos, y un banner indicando que tiene permiso de edición en la vista actual (edición inline pendiente de implementar).

---
Task ID: 14
Agent: main
Task: Revertir a login passwordless — los accesos siguen siendo libres

Work Log:
- User: "recuerda qeu ahora los login estan libres"
- Revertido src/lib/auth.ts a passwordless (estado Task 8):
  * Eliminado import bcrypt
  * Eliminada credential password
  * authorize() vuelve a aceptar sólo email y devuelve el user si isActive
- Revertido src/components/LoginForm.tsx:
  * Eliminado campo contraseña + botón VER/OCULTAR + state showPassword/password
  * Vuelve a ser selector puro "Entrar como:" + botón Entrar
- Editado src/components/ConfigTab.tsx:
  * Eliminado `password` del draft type y de updateDraft
  * Eliminado bloque del input contraseña en el panel expandible
  * Eliminado `row.user?.hasPassword` del resumen de fila
  * Eliminado el hasPassword del tipo Row.user
  * Hint actualizado: "selector del login (sin contraseña)"
  * Grid sm:grid-cols-12 ajustado: 4 cols para el checkbox + 8 cols para el email
- Editado src/app/api/company/permissions/route.ts:
  * Eliminado import bcrypt
  * Eliminada lógica de hashing de password en PUT
  * Si canLogin=true y no existe User → se crea con password=random (placeholder, schema NOT NULL pero nunca validado)
  * Si canLogin=true y existe User → update sin tocar password
  * GET ya no devuelve hasPassword
- UserView.tsx: sin cambios (sigue honrando can_print/can_send y los 10 permisos)
- tsc --noEmit: limpio en todos los archivos tocados
- next build: ✓ Compiled successfully in 3.5s
- Commit dd5d9bc, pushed a origin/main

Stage Summary:
- Login vuelve a ser libre: selector "Entrar como:" sin contraseña
- El módulo Configuración sigue gestionando: quién puede entrar (checkbox Puede iniciar sesión) + email (identificador) + 10 permisos granulares
- User.password en DB sigue siendo NOT NULL por schema; se guarda un placeholder random que nunca se valida
- Si el admin marca "Puede iniciar sesión" en un profesional → aparece en el selector del login → entra directamente
- Si lo desmarca → desaparece del selector y no puede entrar

---
Task ID: 15
Agent: main
Task: Eliminar toda la información que identifica la app (branding, metadatos, leaks)

Work Log:
- User: "quitar de la aplicacion todos los detales qeu pueden dar informacion de la app poara qeu klos usuarios no la puedan copiar ni acceder"
- Auditoría completa con rg en src/ buscando: Mural, MURAL, Método, mural-saas, logo, favicon, Powered by, ©, github, vercel, prisma, next-auth
- src/app/layout.tsx:
  * metadata.title: "Mural by Método" → "Acceso"
  * metadata.description: "Plataforma de gestión de turnos profesional" → "Plataforma de gestión"
  * Eliminado icons: { icon: "/logo.jpeg" }
  * Eliminado themeColor (color verde corporativo #2E5D3A)
  * Eliminado import Geist + Geist_Mono de next/font/google (eliminaba pista de stack + Google Fonts tracking)
  * Body className ahora sólo "antialiased"
- src/components/LoginForm.tsx:
  * Eliminado <img src="/logo.jpeg" alt="Mural by Método"> 
  * Eliminado <h1>MURAL</h1> y <p>by MÉTODO</p>
  * Reemplazado por icono SVG genérico de usuarios en círculo gris
- src/components/AppShell.tsx:
  * Pantalla de carga: eliminado <img logo> + texto "Mural by Método". Ahora spinner CSS + "Cargando…"
  * Navbar: eliminado <img logo> y bloque "Mural / by Método". Reemplazado por avatar con la inicial del nombre de usuario en cuadrado verde
- src/components/MensualTab.tsx:
  * Eliminado <div>MURAL PLASTIC SURGERY</div> del encabezado del calendario mensual (visible en pantalla y al imprimir)
- src/lib/auth.ts:
  * Eliminado fallback `process.env.NEXTAUTH_SECRET || "mural-saas-secret-key-2024-stable"` — ahora `secret: process.env.NEXTAUTH_SECRET` sin fallback. Si no está definido, NextAuth lanzará error al arranque (mejor que usar un secreto conocido)
- next.config.ts:
  * Añadido `poweredByHeader: false` (quita cabecera X-Powered-By: Next.js)
  * Añadido bloque headers() global que fuerza:
    - X-Powered-By: "" (doble seguridad)
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY (evita clickjacking, no se puede embeber en iframe)
    - Referrer-Policy: no-referrer (no filtra URL origen al navegar externo)
    - Permissions-Policy: camera=(), microphone=(), geolocation=() (bloquea APIs sensibles)
- src/app/api/route.ts: cambiado `{ message: "Hello, world!" }` por `{ ok: true }`
- ELIMINADOS endpoints /api/debug/* completos:
  * /api/debug/bcrypt: filtraba hash bcrypt de prueba, hashPrefix del usuario mural@mural.app, userRole, userActive
  * /api/debug/db: filtraba prefijo de DATABASE_URL, conteo de users y sedes
  * /api/debug/login: filtraba internals del login
- ELIMINADOS assets públicos identificativos:
  * public/logo.jpeg (logo principal)
  * public/logo.png
  * public/logo.svg
  * public/favicon.ico
- public/robots.txt: cambiado de "Allow: /" para todos los bots → "Disallow: /" para todos (app privada, no indexable)
- Verificado: ningún archivo en src/ contiene "Mural", "MURAL", "método", "mural-saas", "MURAL PLASTIC"
- Conservados:
  * logoUrl en SuperAdminDashboard y CompanyProfileTab: es el logo de CADA empresa cliente (no de Mural), configurable por ellos. No filtra la identidad de la app.
  * next-auth y prisma como imports de código (necesarios, no visibles para el usuario final)
- tsc --noEmit: limpio en todos los archivos tocados
- next build: ✓ Compiled successfully in 3.4s
- Commit b8722da, pushed a origin/main

Stage Summary:
- La app ya no muestra su nombre ni marca en ningún sitio visible: login, navbar, pantalla de carga, calendarios impresos, pestaña del navegador, metadatos HTML
- Sin logo, sin favicon, sin fuentes de Google (Geist eliminado)
- robots.txt bloquea todos los crawlers
- Headers HTTP endurecidos: no X-Powered-By, no framing, no referrer, no sniff, permissions policy restrictiva
- NEXTAUTH_SECRET sin fallback hardcodeado
- Endpoints de depuración que filtraban internals eliminados
- Asset raíz API devuelve sólo { ok: true }

---
Task ID: 16
Agent: main
Task: Añadir PIN de 4 dígitos opcional por usuario (capa mínima de seguridad sobre el login libre)

Work Log:
- User: "1" (elegida de las opciones propuestas: PIN de 4 dígitos por usuario, gestionado en Configuración, pedido al entrar)
- Schema: añadida columna User.pin String? (nullable). `npx prisma db push --skip-generate` OK (8.17s). `npx prisma generate` OK.
- /api/auth/login-users/route.ts:
  * select ahora incluye `pin: true`
  * cada usuario del listado lleva `hasPin: !!u.pin`
  * El hash NUNCA se expone — sólo el booleano
- /api/company/permissions/route.ts:
  * Import bcrypt
  * GET: devuelve `hasPin: !!u.pin` dentro de user
  * PUT: acepta `pin` en body:
    - pin === undefined → no se toca (leave unchanged)
    - pin === null || "" → pinHash = null (clear)
    - pin === "1234" → valida ^\d{4}$, hashea con bcrypt cost 10
    - Cualquier otro formato → 400 "El PIN debe ser 4 dígitos"
  * Si canLogin=true y existe linked user → update con pin (si pinHash !== undefined)
  * Si canLogin=true y no existe → create con pin (si pinHash !== undefined && !== null)
  * Si canLogin=false → update desactiva + aplica pin si vino
  * Respuesta incluye hasPin actualizado
- src/lib/auth.ts:
  * Import bcrypt
  * CredentialsProvider declara credential `pin: { label: "PIN", type: "text" }`
  * authorize(): si user.pin existe, exige credentials.pin y hace bcrypt.compare. Sin PIN → flujo libre como antes
- src/components/ConfigTab.tsx:
  * Tipo Row.user ahora incluye hasPin: boolean
  * Draft type ampliado: { email, canLogin, pin, pinCleared, perms, dirty }
  * Fila resumida: si row.user?.hasPin → muestra "· PIN activo" en azul
  * Panel expandible: nueva sección "PIN de acceso (opcional)" entre email y permisos
    - Input numeric, maxLength 4, font-mono, tracking-[0.5em]
    - Placeholder dinámico: "•••• (escribir nuevo para cambiar)" si hasPin / "4 dígitos numéricos" si no
    - Hint contextual: "PIN activo configurado" / "Se establecerá este PIN al guardar"
    - Botón "Quitar PIN" → marca pinCleared=true, cambia a rojo sólido "Se quitará al guardar"
  * save():
    - Valida draft.pin (si no vacío) sea ^\d{4}$
    - body.pin = draft.pin (si hay nuevo) | null (si pinCleared) | se omite (si undefined)
    - Reset pin/pinCleared/dirty tras guardar OK
- src/components/LoginForm.tsx:
  * Interface LoginUser + hasPin: boolean
  * State pin + useEffect que resetea pin y error al cambiar selected
  * selectedUser = users.find(email===selected); needsPin = selectedUser?.hasPin
  * handleSubmit:
    - Si needsPin y pin.length !== 4 → error "Introduce el PIN de 4 dígitos"
    - signIn("credentials", { email, ...(needsPin ? { pin } : {}), redirect: false })
    - Si error → "PIN incorrecto" si needsPin, "No se pudo iniciar sesión" si no
  * Selector: cada option lleva emoji 🔒 al final si u.hasPin
  * Condicional {needsPin && (...) } muestra input PIN:
    - type=password, inputMode=numeric, maxLength=4, autoFocus
    - text-2xl tracking-[0.5em] font-mono text-center
    - placeholder "••••"
    - Hint: "Este usuario tiene un PIN configurado. Introduce los 4 dígitos para continuar."
  * Botón Entrar deshabilitado si loading || !selected || (needsPin && pin.length !== 4)
- tsc --noEmit: limpio en todos los archivos tocados
- next build: ✓ Compiled successfully in 3.3s
- Commit e06c50f, pushed a origin/main

Stage Summary:
- El login sigue siendo libre por defecto (selector sin contraseña).
- El admin puede, desde Configuración, asignar un PIN de 4 dígitos a cualquier usuario que tenga acceso activo.
- En el login, los usuarios con PIN aparecen marcados con 🔒 en el selector.
- Al seleccionar uno de ellos, aparece un input grande de 4 dígitos (autofocus, password).
- El botón Entrar no se habilita hasta que el PIN tenga 4 dígitos.
- Si el PIN está vacío al guardar, el acceso queda libre (sin PIN) — utilidad para "Quitar PIN".
- El PIN se almacena como hash bcrypt, nunca se expone en la API (sólo el booleano hasPin).
- Si el admin no configura PIN para nadie, el comportamiento es idéntico al anterior (login libre total).

---
Task ID: 17
Agent: main
Task: Incorporar poder escribir notas al pinchar en cualquier tarjeta de cualquier día de la agenda mensual

Work Log:
- Schema: añadida columna `Plan.notes String @default("")` (no nullable, string vacío por defecto).
- Prisma Client regenerado (`npx prisma generate` OK). El Prisma type Plan ahora incluye `notes: string`.
- Nota: `npx prisma db push` FALLA porque el .env local apunta a una DB Neon que NO es la
  de producción (tiene tablas distintas — AuditResult, BoardConfiguration, etc.) y además
  está desincronizada con el schema (falta columna `slug` en Company, entre otras). El usuario
  tendrá que aplicar el cambio a su DB de producción manualmente:
  SQL directo: `ALTER TABLE "Plan" ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';`
  O bien: `npx prisma db push` con su DATABASE_URL de producción real.
- API PUT /api/company/plan/[id]: ampliado para aceptar dos modos:
  * `{ professionalAlias: "X" }` → actualiza profesional (comportamiento anterior)
  * `{ notes: "texto" }` → actualiza solo la nota (max 2000 chars, "" = borrar)
  * Verificación de seguridad: el plan debe pertenecer a la companyId del usuario que
    lo edita ( impide escribir notas en planes ajenos vía ID ).
- MensualTab.tsx (reescrito):
  * Tipo PlanEntry con notes?: string
  * Estado nuevo: noteModal (planId, sedeName, sedeTask, proName, date, turn), noteText,
    noteSaving
  * openNoteEditor(p, sede, nombre): abre modal precargado con la nota existente
  * saveNote(): PUT /api/company/plan/{id} con body { notes: noteText }; al confirmar,
    actualiza el plan en local state sin recargar todo
  * Cada tarjeta de asignación ahora es clickeable (cursor-pointer, hover ring amber-500).
  * Indicador visual: punto ámbar (•) en esquina superior derecha de la tarjeta si tiene nota.
  * Tooltip de la tarjeta muestra: sede/tarea/turno/profesor en línea 1; si tiene nota,
    "📝 {nota truncada a 200 chars}"; si no, "Click para añadir nota".
  * Modal de nota:
    - Cabecera con fecha formateada (DIA dd/mm/yyyy) y turno (Mañana/Tarde)
    - Textarea autoFocus, maxLength 2000, 6 rows, resize-none
    - Contador "X/2000"
    - Botón "Borrar nota" visible solo si hay texto (vacia el textarea, no guarda aún)
    - Botones Cancelar / Guardar
    - Mientras guarda: "Guardando…" y deshabilita ambos botones
    - Cerrar clickando fuera del modal
  * Hint visible en la cabecera de la tabla: "Click en una tarjeta para añadir/editar nota"
- tsc --noEmit: limpio en los archivos tocados (los errores preexistentes en
  catalog/invoices/professionals no son de esta feature, son código muerto que
  referencia modelos eliminados).
- next build: ✓ Compiled successfully in 7.6s
- Commit local 1e54731 creado con mensaje "feat(mensual): notas por tarjeta en la agenda
  mensual"
- git push origin main: FALLIDO — token de GitHub expirado durante la sesión. El commit
  queda en local, listo para ser empujado en cuanto se renueve el token o se reintente
  desde un entorno con credenciales válidas.

Stage Summary:
- Cada tarjeta de asignación de la agenda mensual (cada celda con sede+turno+profesional)
  es ahora clickeable.
- Al pinchar, abre un modal donde se puede escribir una nota libre (hasta 2000 chars).
- La nota se guarda asociada al turno (sede+fecha+turno), NO al profesional — así
  persiste aunque se cambie el profesional asignado a ese turno.
- Si una tarjeta tiene nota, se le ve un punto ámbar en la esquina.
- El tooltip al pasar el ratón por la tarjeta muestra un preview de la nota.
- Las notas viajan en la API dentro del objeto Plan y se cargan junto con la agenda,
  no generan peticiones extra al abrir la vista.
- IMPORTANTE para el usuario: la columna `notes` debe añadirse a la DB de producción.
  El despliegue en Vercel (vercel.json buildCommand = "npx prisma generate && next build")
  NO hace `db push` automáticamente. Hay que ejecutarlo aparte contra la DB real.

---
Task ID: 18
Agent: main
Task: Migración de la app a nueva cuenta Vercel (tono8) + descubrimiento y resolución del origen real de los datos (Firebase)

Work Log:
- Empujados commits pendientes a GitHub con token nuevo del usuario (f089275..dba3dd5).
- Configurado proyecto Vercel "mural-saas" (prj_Sx403AugFAQGoE7jFEs24rNv41pg) vía API con token de la cuenta tono8:
  * 5 env vars creadas (DATABASE_URL, DIRECT_URL, NEXTAUTH_URL=https://mural-saas.vercel.app, NEXTAUTH_SECRET nuevo, AUTH_TRUST_HOST=true)
  * Deploy de producción disparado vía API → READY en ~1 min
- BUG post-deploy: /api/auth/login-users devolvía 500.
- INVESTIGACIÓN:
  1. El .env del workspace había sido SOBRESCRITO por otra sesión (apuntaba a SQLite de bill-by-metodo). Restaurado desde git history (commit 2f58f5d).
  2. La DB Neon del repo (ep-autumn-queen/neondb) resulta ser la de la 5S APP: el 8-jul-2026 un push del schema de 5S borró TODAS las tablas del mural (sedes, planes, profesionales...). Los usuarios mural@/admin@/julio@ siguen ahí pero con schema viejo.
  3. El deploy antiguo my-project-lemon-five-83.vercel.app está MUERTO (404). El proyecto "my-project" de tono8 es la 5S app, no el mural.
  4. EL USUARIO TENÍA RAZÓN: los datos reales viven en FIREBASE RTDB. Identificado y verificado ACCESO PÚBLICO:
     https://mural-80cc6-default-rtdb.europe-west1.firebasedatabase.app
     - /reyesa_V13_DEFINITIVA (sedes, pros, plan, avisos, festivos, calendarios)
     - /panel_v163 (ausencias AUS-/AV-)
- SOLUCIÓN EJECUTADA:
  1. CREATE DATABASE "mural" en el mismo proyecto Neon (5S intocada en neondb).
  2. prisma db push del schema mural (incluye User.pin y Plan.notes) → OK 23s.
  3. Company "Mural Plastic Surgery" (slug=mural, id cmu5usell0000n49v0no4qglb) + 3 Users recreados (password dummy hasheada — el login es passwordless; PIN sin configurar).
  4. MIGRACIÓN Firebase→Postgres con datos FRESCOS: script nuevo scripts/migrate-firebase-fast.mjs (createMany bulk; el original individual tardaba >5min por roundtrips a US-East).
     Resultado: 17 sedes, 11 profesionales, 122 planes, 1003 avisos, 758 festivos.
  5. Vercel env vars DATABASE_URL/DIRECT_URL actualizadas a /mural vía API (PATCH upsert) + redeploy → READY.
  6. Verificación en vivo: login 200, login-users devuelve los 3 usuarios de la DB nueva, APIs protegidas 401 sin sesión. ✓
- Commits locales pendientes de push NO creados para los scripts con tokens (seguridad): set_vercel_env.sh, trigger_deploy.sh, monitor_deploy.sh, update_env_redeploy.sh contienen el token Vercel en claro y quedan SIN trackear. f5ff4e3 (que los contiene) NO debe pushearse.

Stage Summary:
- LA APP MIGRADA Y OPERATIVA: https://mural-saas.vercel.app (cuenta Vercel tono8)
- Datos: frescos desde Firebase RTDB (no el dump de junio)
- DB nueva "mural" en el mismo proyecto Neon; neondb de la 5S intacta
- Login: selector passwordless con los 3 usuarios; PIN opcional no configurado
- Feature de notas (Plan.notes) disponible desde el primer momento en la DB nueva

PENDIENTES DE SEGURIDAD (avisar al usuario):
1. La Firebase RTDB del mural es PÚBLICA (lectura Y escritura sin auth): datos personales de profesionales (emails, teléfonos) expuestos. Añadir reglas de seguridad URGENTE.
2. La password de la DB Neon está en el historial público del repo (commits 1f4998e, ec9a131, 2f58f5d...). Rotar la password en Neon (afecta también a la 5S si comparte proyecto).
3. Revocar el token de Vercel (vcp_...) tras esta migración — expira en 1 día igualmente.
4. No pushear f5ff4e3 (contiene tokens en scripts). Considerar borrarlo local: git reset --hard dba3dd5 y rehacer commits limpios.

---
Task ID: 19
Agent: main
Task: Recuperar el logo de MURAL + traspaso completo de datos de la app HTML antigua (Firebase RTDB) a la nueva (Neon)

Work Log:
- User: "TE HAS OLVIDADO POR EL CAMINO DEL LOGO DE MURAL. TENGO UNA ANTIGUA APP IGUAL A ESTA Q ES UN CODIGO HTML Y QUE TRABAJA CON FIREBASE, PODRIAMOS TRASPASAR ESA INFORMACION Y NO PERDER NADA A ESTA NUEVA CON NEON?"
- Descubrimiento clave: la app HTML antigua (download/mural.html) usa Firebase RTDB
  "planificador-reybesa-tudela" (path reyesa_V13_DEFINITIVA) — la instancia ACTIVA.
  La migración de la Task 18 usó "mural-80cc6" que es una COPIA DESACTUALIZADA
  (17 sedes vs 22, sin notas_asignacion, sin personalCats).
- Descargados datos FRESCOS en vivo (HTTP 200, lectura pública): download/firebase_live.json
  (8 colecciones: sedes 22, pros 10, plan 15 sedes, notas_asignacion 7, festivos 5 provincias,
  calendarios 5×138 fechas idénticas 2026-2040, avisos 11, personalCats 1) + panel_v163 (3365).
- Análisis panel_v163: contiene datos de la app INDUSTRIAL Reyesa (ROCKWOOL, VIBRACOUSTIC,
  RODAMIENTOS...) que COMPARTE el proyecto Firebase → NO es del mural, EXCLUIDO de la
  migración (la Task 18 lo había importado contaminando con 1003 avisos, ahora limpiados).
- personalCats (1 categoría "TORNEO DE GOLF", sin referencias): excluido, no hay modelo.
- Fix .env local: apuntaba a SQLite (unset DATABASE_URL del shell que pisaba todo) →
  postgres a la DB Neon "mural". El shell de sesión tenía exportada la URL SQLite vieja.
- scripts/migrate-firebase-live.mjs (nuevo, commiteado): borra datos viejos de la company
  e importa desde la instancia ACTIVA: sedes con ord/color/hm/ht, pros completos, 395 planes
  con notas_asignacion FUSIONADAS en Plan.notes (nueva feature), festivos = festivos[provincia]
  ∪ calendario compartido (726 rows, 5 provincias), 11 avisos con pid/sid resueltos.
- LOGO: public/mural-logo.png = logo original de la app antigua (1024×559, verificado
  contra las partes base64 inline del mural.html). Añadido en 3 sitios:
  * AppShell navbar: placa blanca con logo + "MURAL" dorado + "PLASTIC SURGERY" (como la app original)
  * LoginForm: logo centrado sobre la tarjeta blanca
  * MensualTab: logo junto al mes en la cabecera de impresión (print-target, PDF)
- Commit fdc05de → push → deploy Vercel READY (mural-saas-cgpc14098).
- Verificación end-to-end con navegador headless:
  * login-users 200, login OK, sesión Admin Mural OK
  * API: 22 sedes, 10 pros, mensual sept-2026 = 56 planes / 5 con nota, 726 festivos
  * Login: "LOGO PRESENTE" | Navbar: "MURAL PLASTIC SURGERY" | Mensual: logoMensual:true,
    SEPTIEMBRE 2026, 5 indicadores de nota (coinciden con API)
- Screenshots: download/verify_login_logo.png, verify_navbar_logo.png, verify_mensual.png

Stage Summary:
- https://mural-saas.vercel.app OPERATIVA con TODOS los datos de la app antigua:
  22 sedes, 10 profesionales, 395 planes (23 con notas), 726 festivos (2026-2040), 11 avisos.
- Las notas de asignación de Firebase ya son visibles/editables con la nueva feature de notas.
- Logo MURAL original restaurado en login, navbar y cabecera de impresión mensual.
- El selector de años del mensual ahora llega a 2040 (gracias al calendario compartido).
- scripts/migrate-firebase-live.mjs queda commiteado para re-sincronizar si el usuario
  sigue usando la app antigua durante la transición.
- PENDIENTE (avisar al usuario): 2 sedes vacías importadas tal cual (existían en Firebase,
  se pueden borrar desde la pestaña Sedes). Seguridad: Firebase RTDB pública (leer+escribir
  sin auth), password Neon en historial git público (rotar), token Vercel a revocar.

---
Task ID: 20
Agent: main
Task: Simplificar el acceso — un solo campo de contraseña (sin selector de usuarios)

Work Log:
- User: "cambiar el acceso, solo meter una contraseña, la que es"
- src/lib/auth.ts:
  * CredentialsProvider ahora declara solo `password` (sin `email` ni `pin`)
  * authorize() carga TODOS los usuarios activos, los ordena por prioridad de rol
    (SUPER_ADMIN > COMPANY_ADMIN > USER) y devuelve el PRIMERO cuyo hash bcrypt
    coincida con la contraseña introducida. Determinístico en caso de empate.
  * Eliminado el flujo anterior (selector por email + PIN opcional de 4 dígitos)
- src/components/LoginForm.tsx:
  * Eliminado el dropdown de usuarios, fetch a /api/auth/login-users, estado de
    carga de lista, agrupación SUPER_ADMIN/usuarios por empresa, lógica de PIN.
  * Sustituido por un único input type=password con autofocus + botón Entrar.
  * Logo MURAL conservado, paleta y disposición intactas.
  * Mensajes: "Contraseña incorrecta" en caso de fallo.
- scripts/set-admin-password.cjs (nuevo, NO commiteado — opera contra la DB):
  * Setea el password del SUPER_ADMIN (mural@mural.app) a "Mural2024!" — la
    contraseña histórica que el usuario ya conocía (cf. reset-all-pw.cjs).
  * Ejecutado contra producción (Neon "mural"):
    ✓ mural@mural.app password set to "Mural2024!"
    verify bcrypt.compare → ✓ OK
    role=SUPER_ADMIN  companyId=cmu5usell0000n49v0no4qglb
- tsc --noEmit: sin errores nuevos en auth.ts ni LoginForm.tsx (errores preexistentes
  en catalog/invoices/professionals no son de esta feature).
- next build: ✓ Compiled successfully in 7.7s.
- Commit 1c6294d "feat(login): simplify to single-password field" → push a origin/main.
- Verificación E2E contra https://mural-saas.vercel.app:
  POST /api/auth/callback/credentials con password=Mural2024!  → 200 + session-token ✓
  POST con password=wrongpass  → 401 ✗
  POST con password=""        → 401 ✗
  POST con password=admin123  → 401 ✗
  POST con password=mural123  → 401 ✗
  GET /api/auth/session con la cookie devuelta:
    user.email = mural@mural.app
    user.role = SUPER_ADMIN
    user.companyName = Mural Plastic Surgery
    user.companySlug = mural

Stage Summary:
- El login ahora es un solo campo: teclear "Mural2024!" y pulsar Entrar.
- Se autentica como SUPER_ADMIN (mural@mural.app) de Mural Plastic Surgery.
- Eliminado el selector de usuarios y el flujo de PIN — la app es de un único
  usuario principal, así que el acceso queda radicalmente simplificado.
- scripts/test-single-password-login.mjs y verify-session.mjs quedan para
  re-verificar tras futuros cambios.
- PENDIENTE: si el usuario quiere cambiar la contraseña, editar el script
  set-admin-password.cjs y volver a ejecutarlo contra producción.

---
Task ID: 21
Agent: main
Task: Cambiar la contraseña de acceso a "julio1974@"

Work Log:
- User: "que la contraseña sea: julio1974@"
- scripts/set-admin-password.cjs: actualizada la constante newPassword a "julio1974@".
- Ejecutado contra producción (Neon "mural"):
  ✓ SUPER_ADMIN mural@mural.app password set to "julio1974@"
  verify bcrypt.compare → ✓ OK
- scripts/test-single-password-login.mjs y verify-session.mjs actualizados a la nueva
  contraseña y re-ejecutados contra https://mural-saas.vercel.app:
  POST password=julio1974@ → 200 + session-token ✓ (autentica como mural@mural.app SUPER_ADMIN)
  POST password=Mural2024! → 401 (vieja contraseña rechazada) ✓
  POST password=wrongpass   → 401 ✓
  POST password=""          → 401 ✓
  POST password=admin123    → 401 ✓
  POST password=mural123    → 401 ✓
- No hizo falta tocar código ni redeploy: la contraseña vive en la DB (bcrypt hash en
  User.password), el flujo de auth.ts ya itera usuarios y compara el input con el hash
  de cada uno.

Stage Summary:
- La contraseña de acceso a https://mural-saas.vercel.app ahora es: julio1974@
- Entra como SUPER_ADMIN (mural@mural.app, Mural Plastic Surgery).
- La anterior (Mural2024!) ya no funciona.
- Para futuros cambios: editar la línea `const newPassword = '...'` en
  scripts/set-admin-password.cjs y volver a ejecutar `node scripts/set-admin-password.cjs`.

---
Task ID: 22
Agent: main
Task: Dejar un único usuario activo (Julio Murillo / julio1974@) y que entre directo a la app

Work Log:
- User: "solo hay un usuario que es el de la contraseña julio1974@, así que por ahora eso
  eliminalo, no hace falta. este usuario directamente entra en la app y ya"
- Diagnóstico: tras la Task 21, julio1974@ entraba como Julio Murillo (COMPANY_ADMIN) y
  veía la app Mural correctamente. PERO también existían 2 usuarios más activos:
    - mural@mural.app (SUPER_ADMIN) con contraseña super1974@
    - admin@mural.es   (COMPANY_ADMIN) con contraseña aleatoria
  El usuario no quiere ese segundo login SaaS — sólo quiere julio1974@.
- scripts/leave-only-julio.cjs (nuevo):
  * Confirma Julio Murillo con password julio1974@, isActive=true, role=COMPANY_ADMIN.
  * Desactiva mural@mural.app (SUPER_ADMIN) → isActive=false.
  * Desactiva admin@mural.es → isActive=false.
- Resultado: usuarios activos tras la limpieza = 1 (juliomurillozardoya@gmail.com).
- No hace falta tocar código ni redeploy: auth.ts ya filtra `where: { isActive: true }`.
- Verificación E2E contra https://mural-saas.vercel.app:
  julio1974@ → ✓ session  | email=juliomurillozardoya@gmail.com | role=COMPANY_ADMIN | company=Mural Plastic Surgery
  super1974@ → 401 (rechazada) ✓
  Mural2024! → 401 (rechazada) ✓

Stage Summary:
- Único usuario activo en el sistema: Julio Murillo (juliomurillozardoya@gmail.com,
  COMPANY_ADMIN de Mural Plastic Surgery).
- Para entrar: teclear "julio1974@" y pulsar Entrar → va directo a la app Mural
  (pestañas Diario, Mi Empresa, Configuración).
- El panel SaaS (empresas + usuarios) sigue en el código (SuperAdminDashboard) pero
  no es accesible porque no hay ningún SUPER_ADMIN activo.
- Para reactivarlo en el futuro: ejecutar scripts/reassign-passwords.cjs o activar
  mural@mural.app con una contraseña distinta en la DB.

---
Task ID: 23
Agent: main
Task: Configuración de accesos con contraseñas y permisos específicos + filtros de tarjetas en Mensual

Work Log:
- User: "EN CONFIGURACION CONFIGURACION DE ACCESOS CREA CONTRASEÑAS PARA ENTRAR Y PERMISOS O
  ACCESOS MAS ESPECIFICOS. EN MENSUAL CREA PERMISOS PARA PODER ELEGIR VER TARJETAS DE UNA O
  VARIAS SEDES, DE UNO O VARIOS PROFESIONALES Y QUE TARJETAS, DE VACACIONES..., NOTAS O NO
  NOTAS....ETC"
- Schema (prisma/schema.prisma): 4 columnas nuevas en User:
  * allowedSedes TEXT NOT NULL DEFAULT '' (CSV nombres de sedes visibles en mensual; "" = todas)
  * allowedPros TEXT NOT NULL DEFAULT '' (CSV alias de profesionales visibles; "" = todos)
  * showNotes BOOLEAN NOT NULL DEFAULT true (ver notas en tarjetas)
  * showVacaciones BOOLEAN NOT NULL DEFAULT true (ver tarjetas de vacaciones/ausencias)
- Migración aplicada a producción (scripts/add_user_access_columns.cjs, ALTER TABLE ADD COLUMN
  IF NOT EXISTS — aditivo, sin pérdida). Nota: el .env había sido sobrescrito OTRA VEZ a
  SQLite por otra sesión; restaurado a Neon mural.
- src/lib/api-auth.ts: nuevo helper requireCompanyUser() (cualquier rol con companyId) +
  SessionUser ampliado con los 4 campos nuevos.
- GETs abiertos a usuarios USER (lectura): plan, sedes, holidays, professionals, avisos.
  Las escrituras siguen requiriendo COMPANY_ADMIN/SUPER_ADMIN.
- src/lib/auth.ts: jwt/session callbacks exponen allowedSedes/allowedPros/showNotes/
  showVacaciones.
- /api/company/permissions:
  * GET devuelve hasPassword + allowedSedes/allowedPros/showNotes/showVacaciones por acceso
  * PUT acepta password (bcrypt, mín. 4 chars), passwordCleared, y los 4 campos de
    restricción. Email ahora OPCIONAL (auto-genera alias@acceso.mural si falta).
  * Al activar login exige contraseña (nueva o existente).
- ConfigTab.tsx (reescrito):
  * Campo "Contraseña de entrada" (nueva / cambiar / indicador de activa)
  * Sección "Vista Mensual — qué puede ver este acceso":
    - Sedes visibles: checkboxes con color, TODAS/ELEGIR
    - Profesionales visibles: checkboxes con alias+nombre, TODOS/ELEGIR
    - Toggles: 📝 Ver notas / 🏖 Ver vacaciones/ausencias
  * Grupos de permisos anteriores (Diario/Mensual/Sedes/Filtros/Acciones) intactos
- MensualTab.tsx:
  * Filtro TARJETAS: Todas / 📝 Solo con nota / Sin nota
  * Toggle VACACIONES: mostrar/ocultar tarjetas de ausencias
  * Tarjetas de avisos (VACACIONES/BAJA/FORMACION/PERMISO...) visibles en el calendario con
    estilo rayado rojo, etiqueta M/T, motivo, profesional y sede; filtran por sedes/pros
    seleccionados
- UserView.tsx (accesos restringidos):
  * filteredPlans aplica allowedPros/allowedSedes de la sesión
  * diarioRows filtra por allowedSedes
  * Mensual muestra indicador de nota + tooltip (si showNotes) y tarjetas de ausencias
    (si showVacaciones), ambas respetando las restricciones
- next build: ✓ Compiled successfully (8.3s). Commit 21ebe14 → push → deploy READY.
- Verificación E2E (scripts/verify-access-features.mjs) contra producción:
  1. julio1974@ → COMPANY_ADMIN, sesión con los 4 campos nuevos ✓
  2. GET permissions: 10 profesionales ✓
  3. Creado acceso de prueba AT (Alma) con contraseña alma5678, sedes "VITORIA,VIT MED.
     ESTÉTICA", pros "AT,JM" → 200, hasPassword=true ✓
  4. Login alma5678 → USER, sesión lleva allowedSedes/allowedPros exactos ✓
  5. USER lee plan(56)/sedes(20)/avisos(11)/holidays/professionals → 200; PUT permissions
     como USER → 403 ✓
  6. Cleanup: acceso desactivado → contraseña alma5678 rechazada ✓
  7. julio1974@ sigue entrando ✓

Stage Summary:
- Configuración de Accesos: cada profesional puede tener su PROPIA contraseña de entrada y
  permisos específicos: pestañas (diario/mensual/sedes), edición, sedes visibles,
  profesionales visibles, ver notas, ver vacaciones.
- El login único por contraseña sigue igual: se teclea la contraseña del acceso y entra con
  sus permisos (julio1974@ = admin con todo).
- Mensual (admin): filtros nuevos TARJETAS (todas/solo con nota/sin nota) y VACACIONES
  (mostrar/ocultar), además de los filtros de sedes y profesionales existentes. Las
  tarjetas de vacaciones/ausencias ahora se ven en el calendario.
- Los accesos restringidos ven el mensual/diario filtrados según sus permisos, sin notas
  y/o sin vacaciones si así se configura.
- Para crear un acceso: Configuración → Configuración de Accesos → desplegar un
  profesional → activar "Puede iniciar sesión" → contraseña → elegir permisos → Guardar.

---
Task ID: 24
Agent: main
Task: Versión móvil completa como PC + avisos por voz (día, sede, profesional, nota)

Work Log:
- User: "la version mobil, no es completa como la de pc. quiero incorporar el meter los
  avisos por voz, esto seria decir el dia, la sede, el profesional y añadir la nota" y
  aclaración: "que en un movil Android o iPhone, como en una tablet Android/Apple o
  Windows, funcione igual que en un PC con todas las funciones de edición manual y voz"
- .env restaurado a Neon (había sido sobreescrito a SQLite de nuevo); URL recuperada
  descifrando env vars de Vercel (endpoint individual /env/{id}?decrypt=true).
- Schema: Aviso.note String @default("") + migración aditiva en Neon
  (scripts/add_aviso_note_column.cjs, ALTER TABLE ADD COLUMN IF NOT EXISTS) ✓ aplicada.
- API avisos: POST acepta note; nuevo PUT /api/company/avisos/[id] (note, reason).
- src/components/VoiceAvisoButton.tsx (nuevo, ~575 líneas):
  * Botón 🎙️ "Aviso por voz"/"Voz" + modal (Web Speech API es-ES; interimResults; mic
    con pulso al escuchar; errores de permiso; fallback: textarea editable + "Analizar
    texto" para navegadores sin voz — Firefox/iOS viejos).
  * Parser español (parseAvisoText, exportado y testeado): notas ("nota: ...",
    "apunta/anota"), motivos por palabra clave (vacaciones/baja/formación/permiso/
    ausencia/curso/falta), turno ("por la mañana/de la tarde/turno de..."/"tardes"/
    "mañanas"; "mañana" suelto = fecha mañana), fechas ("hoy", "mañana", "pasado
    mañana", "día N" (mes visto; si ya pasó → mes siguiente), "N de MES" (números y
    palabras: quince, veintiuno, treinta y uno...), "N/M", "N-M", días de semana con
    "próximo"), matching por límites de palabra \b de sedes (nombre/token/ciudad) y
    profesionales (alias/nombre/apellido, mejor puntuación).
  * Vista previa editable (fecha, turno Todo el día/M/T, sede, profesional,
    motivo, nota) antes de guardar; "Todo el día" crea 2 avisos (M+T).
- Integración: botón de voz en DiarioTab (junto a HOY) y MensualTab (junto a HOY).
- MensualTab: tarjetas de aviso ahora clicables → editor de nota del aviso (PUT) con
  indicador 📝 y tooltip con nota; botón 🖨️ PDF visible también en móvil; calendario
  con overflow-x-auto + min-w-[780px] (legible en móvil con scroll horizontal);
  padding móvil p-2.
- DiarioTab: al tocar un turno/aviso ocupado ya no hay confirm() a ciego — nuevo
  diálogo táctil con detalle (sede, fecha, turno, pro/motivo, nota) y botón Eliminar
  (paridad con tooltip de PC); columna SEDES móvil 50px→62px (nombre hasta 54px).
- BUG CRÍTICO encontrado y corregido: Julio había quedado como role=USER +
  professionalId en la DB (al probar Configuración de Accesos, un profesional compartía
  su email y el PUT de permissions forzaba role:"USER" sobre la cuenta vinculada).
  * Restaurado en DB: Julio = COMPANY_ADMIN, professionalId=null.
  * Guarda en /api/company/permissions PUT: rechaza si el usuario vinculado es admin
    o la propia sesión ("Ese profesional está vinculado a una cuenta de administrador...").
  * Guarda en /api/company/users/[id] PUT: prohibido cambiar el propio rol; obligatorio
    mantener ≥1 COMPANY_ADMIN activo; roles limitados a USER/COMPANY_ADMIN.
- Tests parser: scripts/test-voice-parser.mjs — 6/6 ✓ (incluye fix de matching con
  puntuación adyacente: comas tras nombres/sedes).
- E2E producción: scripts/verify-voice-avisos.mjs — login julio1974@ ✓, POST aviso
  M+T con note ✓, PUT nota ✓, persistencia por turno ✓, cleanup ✓ → "TODO OK".
- Verificación UI real con agent-browser (viewport iPhone 14):
  login ✓ → CompanyDashboard admin ✓ → botón "🎙️ Voz" en Diario ✓ → modal → texto
  "el dia 15 en Vitoria, JM, vacaciones, nota: se va de viaje" → Analizar → preview:
  15/10/2026, Todo el día, VIT, JM-JULIO, VACACIONES, nota "se va de viaje" ✓ →
  Guardar → 2 avisos en BD ✓ → Mensual OCTUBRE muestra "M/T 🏖 VACACIONES - JM (VIT) •"
  ✓ → tap tarjeta → editor de nota con todos los datos ✓ → limpieza de prueba ✓.
  Capturas: download/voice-modal-saved.png, download/mensual-movil-avisos.png.
- Builds ✓ (8.0-8.4s). Commits: 0275a00 (feature), 30ea91f (guardas) → deploy READY.

Stage Summary:
- Nueva función: avisos por voz en Diario y Mensual — dictar "el día X en [sede],
  [profesional], [motivo], nota: ..." o escribirlo; preview editable; día completo
  crea M+T; nota del aviso guardada y visible.
- Notas de aviso: campo note persistido, editable tocando la tarjeta en Mensual,
  indicador • + tooltip con nota también en Diario.
- Paridad móvil/tablet/PC: todas las pestañas usables en táctil, PDF en móvil,
  calendario mensual con scroll legible, diálogo de detalle en Diario al tocar,
  fallback de texto cuando el navegador no soporta dictado.
- Seguridad: imposible auto-degradar el rol admin ni dejar una empresa sin admin;
  los accesos ya no pueden secuestrar cuentas de administrador.
- Login admin intacto: julio1974@ → app MURAL completa.

---
Task ID: 25
Agent: Super Z (main)
Task: Mensual swipe táctil para cambiar de mes; cabecera "Acceso" → "MURAL"; avisos por voz como permiso elegible en Configuración de Accesos.

Work Log:
- MensualTab: navegación por gesto — swipe izquierda = mes siguiente, derecha = anterior (umbral 60px, eje horizontal dominante para no interferir con scroll vertical); siempre arranca en el mes actual (ya existente). Flechas ‹ › junto al título del mes (no-print) + pista móvil "Desliza el dedo ‹ › para cambiar de mes". Animación de deslizamiento (keyframes month-slide-next/prev en globals.css, remount por key año-mes).
- Conflict resuelto: tabla mensual dejó de forzar min-w-[780px] → ahora cabe en el ancho del móvil/tablet y el swipe no compite con el scroll horizontal.
- layout.tsx: metadata title "Acceso" → "MURAL" (pestaña del navegador / pantalla de inicio).
- Permiso elegible "can_voice_avisos" (grupo Acciones en ConfigTab): añadido a PERM_KEYS en /api/company/permissions (GET parse + PUT persist), catálogo PermKey/PERM_GROUPS de ConfigTab (checkbox con ayuda), y Perms/parsePerms de UserView.
- UserView: VoiceAvisoButton visible si el acceso tiene can_voice_avisos (junto a Imprimir/Enviar); /api/company/professionals ahora se carga siempre; onSaved recarga datos.
- API /api/company/avisos POST: admins siempre; USER solo si su CSV de permisos incluye can_voice_avisos (getSessionUser en vez de requireCompanyAdmin).
- FIX latente: POST /api/company/professionals hacía 500 al no llegar startDate (null sobre String NOT NULL) — coerción segura de campos string; así la creación de profesionales por API/UI vuelve a funcionar.
- FIX impresión: no existía @media print (el botón 🖨️ PDF imprimía toda la app). Nuevo CSS: solo #print-target visible (guard body:has(#print-target); .no-print display:none). id="print-target" añadido al mensual de UserView.
- Scripts/verificación: scripts/verify-voice-perm.mjs — E2E producción completo: crea pro+acceso sin permiso → POST aviso = 403 ✓; activa can_voice_avisos → re-login → POST = 201 ✓; cleanup (aviso+usuario+profesional) ✓ → TODO OK.
- UI real (agent-browser, viewport iPhone 14): login ✓ → Mensual inicia SEPTIEMBRE 2026 ✓; ‹/› cambian OCTUBRE/SEPTIEMBRE ✓; TouchEvent swipe izq→OCTUBRE ✓, swipe der→SEPTIEMBRE ✓; swipe vertical NO cambia mes ✓; pista móvil visible ✓; botón 🎙️ Voz presente ✓; Configuración → fila JULIO → checkbox "🎙️ Avisos por voz" existe (unchecked por defecto) ✓. title MURAL en HTML ✓.
- Commits: 9d463fc (feature), 723f47f + a589d05 (higiene repo), 1088a95 (fix professionals POST). Deploy Vercel READY.

Stage Summary:
- Mensual navegable con el dedo en móvil/tablet (swipe ‹ ›, flechas, animación) y arranca siempre en el mes actual.
- App identifica como MURAL en la cabecera/pestaña.
- "Avisos por voz" ahora es un permiso elegible por acceso en Configuración de Accesos → Acciones: el profesional ve el botón 🎙️ en su vista y el API se lo permite; sin el permiso el backend rechaza (403).
- Corregidos dos bugs de fondo: 500 al crear profesional por API y estilos de impresión inexistentes.
- Verificado E2E en producción (UI táctil simulada + API): todo verde.

---
Task ID: 26
Agent: Super Z (main)
Task: CarPlay / Android Auto — respuesta + solución práctica instalable (PWA + Modo Coche).

Work Log:
- Respuesta al usuario: la integración NATIVA CarPlay/Android Auto NO es posible para MURAL
  (Apple solo aprueba categorías navegación/audio/mensajería/parking/comida y exige app
  nativa Swift con entitlement especial; Google exige app nativa Kotlin + categorías
  media/mensajería/navegación/POI). Solución práctica implementada: PWA instalable + "Modo Coche".
- scripts/make_pwa_icons.py: iconos generados desde mural-logo.png recortando la marca M
  (bbox sin blanco) sobre lienzo blanco → icon-192, icon-512, apple-touch-icon (180),
  maskable-512 (zona segura 46%).
- public/manifest.webmanifest: name MURAL Plastic Surgery, display standalone, orientación
  libre, theme #0b1120, iconos any+maskable, shortcut "Modo Coche" → /coche.
- public/sw.js: service worker passthrough (sin interceptar respuestas → cero riesgo de
  cachés obsoletas; satisface instalabilidad Android/Chrome).
- SWRegister.tsx registrado en layout.tsx; metadata PWA completa: manifest, appleWebApp
  (capable/title/status-bar), icons, themeColor #0b1120, viewportFit cover + meta legacy
  apple-mobile-web-app-capable (fix compat iOS; Next emite solo mobile-web-app-capable).
- src/app/coche/page.tsx (MODO COCHE): pantalla oscura gigante para móvil/tablet en
  soporte de coche — reloj enorme (tick 20s), fecha es-ES, botón micrófono 128-160px
  que abre VoiceAvisoModal (dictado por voz completo), lista "AVISOS DE HOY" con badges
  MAÑANA/TARDE + motivo coloreado + nota 📝, botón ⟳, "← App completa", wake lock
  (pantalla no se apaga, re-adquiere al volver a visible), redirección a / si sin sesión,
  layout responsive portrait/landscape (landscape:grid-cols-2) y safe-area insets.
- AppShell: botón 🚗 en navbar desktop + "🚗 Modo coche" en menú hamburguesa móvil.
- Build ✓ (8.5s). Commits: 1db020b (PWA+Modo Coche), 6f5a085 (meta legacy iOS) → deploy READY.
- Verificación producción scripts/verify-pwa.sh: 13/13 ✓ (manifest, standalone, shortcut,
  4 iconos, sw.js, /coche 200, metas manifest/apple/icons en HTML).
- UI real agent-browser (iPhone 14): login ✓ → menú móvil → "🚗 Modo coche" → /coche ✓
  (reloj 17:37, fecha, mic gigante, avisos hoy 0) → tap mic → modal voz ✓ → texto
  "hoy en Vitoria, Julio, vacaciones, nota: prueba modo coche" → Analizar → Guardar
  (Todo el día) → 2 avisos MAÑANA/TARDE VACACIONES JULIO MURILLO VIT + nota visibles ✓
  → landscape (844x390): 2 columnas reloj+mic / avisos ✓. Capturas: download/
  modo-coche-portrait.png, modo-coche-con-aviso.png, modo-coche-landscape.png.
- Cleanup scripts/cleanup-car-test.mjs: DELETE de los 2 avisos de prueba → 0 restantes ✓.

Stage Summary:
- MURAL es ahora una PWA instalable: iPhone (Safari → Compartir → Añadir a pantalla de
  inicio) y Android (Chrome → ⋮ → Instalar app) se abre a pantalla completa sin navegador,
  con icono de la marca M en pantalla de inicio y acceso directo "Modo Coche".
- Nueva ruta /coche: pantalla de coche con reloj gigante, dictado de avisos por voz a un
  toque, avisos de hoy en letra grande con notas, pantalla siempre encendida. Con el móvil
  en el soporte del salpicadero cumple la función que CarPlay/Android Auto no permiten para
  apps de gestión.

---
Task ID: 27
Agent: Super Z (main)
Task: Entradas por voz sin tocar la pantalla (conducir) — Modo Manos Libres con diálogo de audio.

Work Log:
- Petición: que las entradas por voz eviten usar la pantalla en el coche; propuesta del
  usuario: preguntas de audio. Diseño: conversación guiada por voz (la app pregunta por
  altavoz con TTS y escucha respuestas con SpeechRecognition), una sola pulsación para
  arrancar (gesto obligatorio del navegador), cero toques después.
- src/lib/voice-dialog.ts (lógica pura, sin DOM, testeable): parseDateAnswer (hoy/mañana/
  pasado mañana/día N/N de mes/N-M/día de la semana/número suelto), matchSedeAnswer
  (número de lista o nombre/ciudad con mejor puntuación), matchProAnswer (número, alias o
  nombre; "toda la sede"), parseTurnAnswer (mañana/tarde/todo el día, ambos → ALL),
  parseReasonAnswer (palabras clave o número 1-5), parseYesNo, wantsStop/wantsCancel/
  wantsRepeat/wantsAnother, speechList ("1 A, 2 B o 3 C"), dateLabel, turnPhrase,
  parseListNumber.
- src/components/HandsFreeOverlay.tsx: máquina de estados por refs (sin stale closures):
  date → sede (se salta si solo hay 1) → pro → turno → motivo → nota → confirmación
  "¿Guardo?" → guardado → bucle "¿Otro aviso?". TTS es-ES con fallback por timeout si
  onend no dispara; re-escucha tras cada pregunta; comandos de voz globales: «terminar»,
  «cancela», «repite»; reintento si no se oye (hasta 3 fallos); manejo de mic bloqueado
  (mensaje + CERRAR); UI: paso actual (1·DÍA … 7·CONFIRMAR), pregunta grande, lo que se
  oye en vivo, ficha del borrador, registro de conversación, botón ■ PARAR, z-60.
- /coche: botón "🔊 MANOS LIBRES" (borde verde) bajo el micrófono gigante + pista "Para
  conducir: la app pregunta por voz y tú solo hablas"; overlay montado con onSaved=load
  (la lista de hoy se refresca sola tras cada guardado).
- Tests: scripts/test-voice-dialog.mjs (node --experimental-strip-types sobre el TS real,
  sin duplicar lógica) — 53/53 ✓ (fechas, sedes, pros, turno, motivo, sí/no, intenciones,
  locución; fix de expectativa "1 A o 2 B").
- Build ✓ (8.6s). Commit b68be46 → deploy Vercel READY; bundle /coche contiene
  "MANOS LIBRES" ✓.
- UI real (agent-browser iPhone 14): login → /coche → botón 🔊 MANOS LIBRES ✓ → overlay
  abre, paso "1 · DÍA", pregunta por TTS arranca, y sin micrófono (headless) muestra el
  mensaje de micrófono bloqueado con CERRAR (comportamiento diseñado). Captura:
  download/manos-libres-overlay.png.

Stage Summary:
- Nuevo Modo Manos Libres en /coche: se pulsa una vez antes de conducir y a partir de ahí
  la app conduce la conversación por audio: pregunta día → sede → quién → turno → motivo →
  nota → "¿Guardo?"; entiende números ("1", "dos"), nombres, alias, fechas relativas y
  comandos «cancela/repite/terminar». Bucle para dictar varios avisos seguidos sin tocar
  nada. Lógica validada con 53 tests; desplegado en producción.

---
Task ID: 28
Agent: Super Z (main)
Task: Extender Modo Coche a móvil/tablet/PC con dos botones (Modo Coche + Modo PC), y mejorar el Diario en PC con drag-to-scroll, scrollbar visible y atajos de teclado.

Work Log:
- Petición: el Modo Coche (manos libres con preguntas de audio) debe usarse también en
  móvil, tablet y PC (no solo en el coche); debe haber dos botones de audio: "Modo Coche"
  (preguntas encadenadas, sin mirar la pantalla) y "Modo PC" (dictado libre en una frase,
  el que ya existía). Además, en el Diario de PC fijar todo excepto las tarjetas y permitir
  arrastrar con el ratón (botón izquierdo presionado) para desplazar arriba/abajo/izq/dcha;
  actualmente no se ve la barra de scroll y al bajar del todo se pierden las fechas.
- src/components/VoiceAvisoButton.tsx: añadido `VoiceButtons` — dos botones juntos (🔊 Modo
  Coche → abre HandsFreeOverlay; 🎙️ Modo PC → abre VoiceAvisoModal). El default export
  `VoiceAvisoButton` se mantiene para compatibilidad con texto actualizado a "Audio Modo
  PC". Import de HandsFreeOverlay dentro del mismo archivo para que todo se resuelva en
  un solo módulo.
- src/components/DiarioTab.tsx: sustituido `<VoiceAvisoButton>` por `<VoiceButtons>` en la
  toolbar (mismas props: sedes/professionals/onSaved/contextYear/contextMonth).
- src/components/MensualTab.tsx: idem, sustituido por `<VoiceButtons>` importando el named
  export.
- src/components/UserView.tsx: idem dentro del bloque `perms.can_voice_avisos`.
- src/app/coche/page.tsx: etiquetas más claras — el botón mic gigante ahora reza "AUDIO
  MODO PC" con subtexto "Dictado libre: pulsa y di …"; el botón secundario ahora reza
  "🔊 AUDIO MODO COCHE" en ámbar (en lugar del verde anterior) para distinguirlo del
  Modo PC.
- src/components/DiarioTab.tsx (PC improvements):
  * Drag-to-scroll: estado `dragging` + `dragRef` ({x,y,sx,sy,moved}); onMouseDown inicia
    drag solo con botón izquierdo; window mousemove actualiza scrollLeft/scrollTop con
    delta; mouseup limpia el flag con micro-retraso de 50ms para que el click siguiente
    sea normal si no hubo arrastre real, o se suprima si lo hubo (suppressIfDragged en los
    onClick de cada celda — no se asigna/borra un turno por error al soltar el botón tras
    arrastrar).
  * Scrollbar visible: clases `.diario-scroll` y `.diario-drag` añadidas a globals.css:
    WebKit (::-webkit-scrollbar 12px, thumb #475569, track #1e293b, hover #64748b,
    esquina) + Firefox (scrollbar-width:auto, scrollbar-color). Aplicadas al contenedor
    flex-1 overflow-auto del grid del Diario.
  * Cursor grab/grabbing: `.diario-drag` (cursor:grab, user-select:none) y `.dragging`
    (cursor:grabbing + pointer-events:none en hijos para que el click se suprima).
  * Atajos de teclado: T=scrollToToday, ←↑↓→=scrollBy 120px smooth, PageUp/PageDown=90%
    del cliente. No interferir si el foco está en input/textarea/select/contentEditable.
  * Rueda + Shift = scroll horizontal (ya funciona en la mayoría de navegadores; lo
    dejamos pasar sin preventDefault).
  * Leyenda visible en toolbar (PC, sm:flex): kbd T / ←↑↓→ / Drag con sus textos.
- src/app/globals.css: añadidas `.diario-scroll` (scrollbar visible multi-navegador) y
  `.diario-drag`/`.dragging` (cursor + supresión de selección de texto).
- Build ✓ (8.0s, "Compiled successfully"). Commit 9055468 → push a main → deploy Vercel
  READY (HTTP 200 en /, /coche).
- Verificación E2E (agent-browser):
  * Diario: botones "🔊 Modo Coche" y "🎙️ Modo PC" presentes; clic en Modo Coche abre
    overlay "MANOS LIBRES" (paso 1·DÍA, luego mensaje de micrófono bloqueado por ser
    navegador headless); clic en Modo PC abre modal "🎙️ Aviso por voz" con textarea y
    "Analizar texto". Cierro overlay con botón PARAR.
  * Mensual: idem — "🔊 Modo Coche" + "🎙️ Modo PC" presentes en toolbar.
  * /coche: botón "🎙️" gigante con etiqueta "AUDIO MODO PC"; botón "🔊 AUDIO MODO
    COCHE" en ámbar presente.
  * Diario PC: clase `diario-scroll diario-drag` aplicada al contenedor; `overflow:auto`,
    `scrollbarWidth:auto`; <kbd> presentes en leyenda (T, ←↑↓→, Drag).
  * Capturas: download/diario-voz-dos-botones.png (full), download/coche-dos-botones.png.

Stage Summary:
- Modo Coche (manos libres con preguntas) y Modo PC (dictado libre con vista previa)
  ahora disponibles juntos en Diario, Mensual, Permiso (UserView) y /coche. En móvil,
  tablet y PC. El usuario elige según contexto: Modo Coche para conducir o cuando no
  quiere mirar la pantalla; Modo PC para escribir una frase entera y revisar el resultado
  antes de guardar.
- Diario en PC: barra de scroll siempre visible (estilo dark), drag-to-scroll con ratón
  (botón izquierdo + arrastrar, cursor grab/grabbing) sin clicks accidentales, atajos
  T=Hoy, flechas=scroll, PageUp/Down, Shift+rueda=horizontal; leyenda visible en toolbar.
  Las cabeceras (días arriba, sedes izquierda) ya eran sticky y se mantienen fijas al
  desplazar — ahora combinadas con scrollbar visible y drag se ve claramente dónde se
  está en el año y no se pierden las fechas al bajar del todo.

---
Task ID: 29
Agent: Super Z (main)
Task: Botones MODO COCHE / MODO PC grandes y resaltados en la barra principal del inicio; /coche (CarPlay/Android Auto) restringido al método Coche por seguridad.

Work Log:
- Petición: los dos botones de voz deben estar en la pantalla de inicio, en grande, en la
  línea de MI EMPRESA/DIARIO/CONFIGURACIÓN pero a la derecha y resaltando; y en el coche
  (pantalla /coche) por seguridad solo debe poder usarse el método Coche (manos libres),
  no el dictado libre.
- src/components/CompanyDashboard.tsx:
  * Añadidos fetch de sedes+professionals al montar (para alimentar overlays globales).
  * En la barra de main tabs, contenedor ml-auto con dos botones grandes: 🔊 MODO COCHE
    (gradiente ámbar from-amber-500, texto negro, shadow glow ámbar 18px) y 🎙️ MODO PC
    (gradiente verde, ring #6BBE7A, glow verde). En móvil solo icono+palabra corta.
  * Ambos abren sus overlays fullscreen (HandsFreeOverlay / VoiceAvisoModal) desde
    cualquier pestaña; disabled si no hay sedes cargadas.
- src/app/coche/page.tsx:
  * Eliminado el Modo PC (VoiceAvisoModal, botón gigante anterior, estado voiceOpen).
  * El botón gigante único (w-36/44, gradiente ámbar, glow) ahora abre directamente el
    diálogo manos libres; etiqueta "AUDIO MODO COCHE" en ámbar; subtítulos: "La app
    pregunta por voz y tú respondes hablando — 100% manos libres" y "🛡️ Único método
    disponible al conducir por seguridad". Comentario de cabecera documenta la decisión
    de seguridad (dictar libre exige mirar la pantalla para revisar/editar).
- src/components/AppShell.tsx: botón 🚗 del navbar ahora ámbar resaltado con glow y title
  aclarando "solo manos libres por seguridad".
- Build ✓ (7.7s). Commit 9dfedca → deploy Vercel READY.
- Verificación E2E (agent-browser): login → inicio: botones "🔊 Modo Coche" x=654 y
  "🎙️ Modo PC" x=807 a la derecha de la línea de tabs, con gradiente aplicado (linear-
  gradient lab() tras reload de CSS; el primer load sirvió CSS cacheado del build previo).
  /coche: solo existe el botón 🔊 gigante "AUDIO MODO COCHE" + aviso de método único;
  clic abre overlay "MANOS LIBRES" paso "1 · DÍA" (mic bloqueado solo por headless).
  Capturas: download/inicio-botones-grandes.png, download/coche-solo-modo-coche.png.

Stage Summary:
- Inicio con los dos accesos de voz siempre visibles, grandes y a la derecha: Modo Coche
  (preguntas por audio, sin mirar) y Modo PC (dictado libre con revisión), funcionando
  desde cualquier pestaña del panel.
- /coche ahora es 100% seguro para conducir: un solo método (manos libres), cero necesidad
  de tocar o mirar la pantalla; el dictado libre queda fuera de la pantalla de coche.

---
Task ID: 30
Agent: main
Task: Quitar los botones de voz de las barras de herramientas (Diario/Mensual); los grandes de la línea superior solo visibles en la pestaña DIARIO

Work Log:
- Petición del usuario (captura con los botones pequeños tachados en rojo): "quitar esos botones y que los de avisos de arriba solo aparezcan cuando se elija diario en el menu de arriba".
- src/components/DiarioTab.tsx: eliminado <VoiceButtons> de la fila de herramientas (HOY / Compacto quedan limpios) y eliminado el import de VoiceAvisoButton (no se usaba para nada más; el modal inline de avisos es autónomo).
- src/components/MensualTab.tsx: eliminado <VoiceButtons> de su barra (HOY → PDF directo) y su import.
- src/components/CompanyDashboard.tsx: los dos botones grandes 🔊 MODO COCHE / 🎙️ MODO PC de la línea MI EMPRESA/DIARIO/CONFIGURACIÓN ahora se renderizan condicionados a {tab === "diario" && (...)}; overlays globales intactos.
- UserView (rol USER) se deja igual: no tiene el menú superior MI EMPRESA/DIARIO/CONFIGURACIÓN y sus botones están gated por permiso can_voice_avisos.
- Build ✓ (8.1s). Commit 1a607a4 → push main → Vercel READY (HTTP 200).
- E2E producción (agent-browser, login julio1974@): DIARIO → botones grandes presentes (x=962 y x=1160, y=86) y barra del grid limpia (solo HOY + ▦ Compacto); MI EMPRESA → 0 botones de voz; CONFIGURACIÓN → 0 botones de voz; sub-tab Mensual → solo los 2 grandes de arriba; /coche → intacto (solo 🔊 AUDIO MODO COCHE, sin Modo PC).
- Capturas: download/diario-botones-solo-arriba.png, download/mensual-sin-botones-voz.png, download/mi-empresa-sin-botones-voz.png.

Stage Summary:
- Los avisos por voz viven SOLO en la línea superior (grandes, a la derecha, resaltados) y únicamente cuando la pestaña activa es DIARIO (incluye sus sub-tabs Diario/Mensual/Sedes/Pros/Calendarios).
- Sin duplicados en las barras de herramientas del Diario y Mensual.
- /coche mantiene su restricción de seguridad: único método manos libres.

---
Task ID: 31
Agent: main
Task: Modo Coche con listas numeradas estilo CarPlay + cabeceras fijas del Diario al hacer scroll

Work Log:
- Petición: "las preguntas del modo coche son un coñazo... que diga elige número de la lista, muestre la lista en la pantalla del coche y decir el número, igual con el profesional, la nota libre" + "los días no se quedan fijos al subir y bajar scroll, fijar sedes y días de arriba".
- src/lib/voice-dialog.ts: parseTurnAnswer acepta números (1 mañana/2 tarde/3 todo); nuevos helpers upcomingDays(count) y shortDateLabel ("VIE 19/9"). Tests ampliados: 63 OK / 0 fallos (scripts/test-voice-dialog.mjs) + test-voice-parser 6 OK.
- src/components/HandsFreeOverlay.tsx — rediseño completo estilo CarPlay:
  * Cada paso muestra LISTA NUMERADA EN PANTALLA (día: 10 próximos días con HOY/MAÑANA; sede; profesional + "TODA LA SEDE" como última opción; turno 1/2/3; motivo 1-5; ¿otro? IGUAL/NUEVO/TERMINAR).
  * El TTS solo dice frases cortas ("Sede. Elige número.") — ya no lee las listas por altavoz. rate 1.02→1.15.
  * Respuesta por número: "dos", "el 3", "2"... (parseListNumber) con fallback a nombres. Nota en UN paso ("di la nota o di sin nota", atajo táctil SIN NOTA).
  * Tras guardar: "¿Igual, nuevo o terminar?" — IGUAL repite sede+pro+turno y solo pregunta día y motivo (memoria lastRef).
  * Botones táctiles de apoyo: GUARDAR/✕ NO en confirmación, filas de lista clicables.
  * Fix: ask() no actualizaba el estado step (chip congelado en 1·DÍA, botones de confirmación no salían) → setStep(step) añadido.
- Fix cabeceras fijas (3 causas encadenadas):
  1) sticky top-0 estaba en <thead> (Chrome lo ignora) → movido a cada <th>; esquina sticky left+top z-30; días z-20; sedes z-10. Tabla border-collapse → border-separate border-spacing-0 (requisito sticky cross-browser).
  2) Cadena de alturas sin acotar: CompanyDashboard rama diario → h-full flex flex-col min-h-0; wrapper de sub-tabs flex-1 min-h-0 (overflow-auto para Sedes/Pros/Cal).
  3) AppShell root min-h-screen → h-dvh overflow-hidden (los 3 dashboards ya eran h-full overflow-hidden; ahora el grid scrollea DENTRO y el toolbar/sub-tabs quedan fijos).
- Builds ✓ (3 deploys). Commits: e2f54d4, e9668ec, 10c104d, 6b3b74b → Vercel READY.
- Verificación E2E producción (agent-browser + stub de SpeechRecognition para ver la UI sin micro):
  * /coche: lista de 10 días numerados ✓; tap 2=MAÑANA → 2·SEDE ✓; tap 1=VIT → 3·PROFESIONAL ✓ (10 pros + TODA LA SEDE) ✓; 4·TURNO ✓; 5·MOTIVO ✓; 6·NOTA con SIN NOTA ✓; 7·CONFIRMAR con GUARDAR/✕NO ✓; ✕NO → IGUAL/NUEVO/TERMINAR ✓; TERMINAR cierra limpio ✓ (sin escrituras en BD).
  * Diario desktop: scrollTop=400 → dayTop constante (días fijos) ✓; scrollLeft=500 → sedeLeft constante (sedes fijas) ✓; grid scrollea dentro (clientH 383 < scrollH 1245) ✓.
  * Diario móvil (390×844): grid scrollea dentro y días fijos ✓. Mensual y Configuración renderizan ✓. /coche sin Modo PC ✓.
  * Capturas: download/diario-cabeceras-fijas.png.

Stage Summary:
- Modo Coche rápido y sin fricción: ver listas numeradas grandes, responder solo el número, nota opcional saltabile y encadenar avisos con "igual". La voz solo da instrucciones cortas.
- Diario con cabeceras de días fijas al scroll vertical, columna de sedes fija al horizontal y barra de herramientas siempre visible (desktop y móvil).

---
Task ID: 32
Agent: main
Task: Modo Coche — eliminar la pregunta de MOTIVO; pasar directo a "¿Quieres poner nota?" (sí/no) y nota libre si sí

Work Log:
- Petición: "la pregunta que hace de motivo no existe, ya que la tarjeta se genera con las iniciales del profesional en la sede y día que se ha dicho; ese se quita y se pone 'quieres poner nota', tiene que decir sí o no; si es sí se dice la nota libre".
- src/components/HandsFreeOverlay.tsx — flujo nuevo: día → sede → profesional → turno → ¿NOTA? → confirmación (de 7 pasos a 6):
  * Step "reason" eliminado del tipo Step; Draft sin campo reason; reasonOptions() eliminada; imports parseReasonAnswer/REASON_OPTIONS quitados.
  * Tras el turno → paso "note": "¿Quieres poner nota?" con lista táctil [1 SÍ · dictar una nota / 2 NO · guardar sin nota]; respuesta ESTRICTA sí/no (voz o número 1/2); nada de dictar en este paso.
  * Si SÍ → paso "noteText" "Di la nota": nota libre en UN paso (atajo "sin nota" por si se arrepiente). Si NO → confirmación directa.
  * Atajo IGUAL (repetir sede+pro+turno): tras el día ahora pregunta directamente "¿Quieres poner nota?" (antes motivo).
  * Guardado envía reason: DEFAULT_REASON = "AUSENCIA" (fallback que la app ya usa en todas las vistas: Diario muestra iniciales del pro, Mensual/UserView muestran AUSENCIA).
  * Renumeración: 1·DÍA, 2·SEDE, 3·PROFESIONAL, 4·TURNO, 5·¿NOTA?/5·NOTA, 6·CONFIRMAR. Borrador de pantalla sin celda Motivo (5 celdas).
  * Resumen hablado/pantalla de confirmación sin motivo (solo día, sede, quién, turno, nota).
- voice-dialog.ts intacto (parseReasonAnswer/REASON_OPTIONS siguen exportados y testeados; los usa el Modo PC).
- Build ✓. Tests 63/0 (test-voice-dialog) + 6/0 (test-voice-parser). Commit df415c0 → Vercel READY (chunk producción contiene "Quieres poner nota").
- E2E producción (/coche, login julio1974@, stub SpeechRecognition con cola de respuestas + descartador automático del botón ✕ NO):
  * Flujo completo: 1·DÍA → 2·SEDE → 3·PROFESIONAL → 4·TURNO → 5·¿NOTA? ("¿Quieres poner nota?" con SÍ/NO) → [sí] 5·NOTA "Di la nota" → nota libre → 6·CONFIRMAR → ✕ NO → "Aviso descartado" → ¿IGUAL/NUEVO/TERMINAR? ✓
  * Cero texto "motivo" en todo el flujo ✓; borrador 5 celdas sin Motivo ✓; chip "5 · ¿NOTA?" con echo "por la mañana" ✓.
  * Sin escrituras en BD ("Sin avisos para hoy" tras todo el test) ✓.
  * Capturas: download/coche-di-la-nota.png (paso nota con borrador de 5 celdas).

Stage Summary:
- El Modo Coche ya no pregunta el motivo: la tarjeta se identifica sola con profesional + sede + día. Un aviso se dicta en 4 respuestas (día, sede, pro, turno) + "¿nota? sí/no" opcional + "guarda" — y con IGUAL solo 3 (día, ¿nota?, guarda).

---
Task ID: 33
Agent: main
Task: Día LIBRE por voz en Modo Coche + las 12 mejoras (funcional/ágil/interactiva/rápida/moderna/profesional)

Work Log:
- PETICIÓN: "no me gusta la elección del día en modo coche, yo la dejaría libre" + "las mejoras hacerlas todas".
- A) MODO COCHE — DÍA LIBRE: HandsFreeOverlay paso "date" ahora interpreta la voz con parseDateAnswer PRIMERO (hoy, mañana, pasado mañana, el viernes, día 15, 15 de octubre, 15/10, número suelto = día del mes). La lista de 10 días queda como APOYO TÁCTIL: los taps van por handleTap() (canal separado de la voz). Locución corta "¿Qué día?"; en fallo: "Di el día: mañana, viernes, día 15". Renumeración intacta (1·DÍA…6·CONFIRMAR). Tests nuevos: 68 OK / 0 fallos (parseDateAnswer libre: 23, viernes, el martes, veintiocho, inválido).
- B) SCHEMA (db push OK): Aviso.seenAt; Company.brandColor + notifyEmail; modelos nuevos AuditLog y OutboxNotification (con índices y relación a Company).
- C) APIs: lib/audit.ts (logAudit fire-and-forget + queueAvisoEmail con RESEND_API_KEY opcional); /api/company/audit (GET últimos 150); /api/company/stats (por mes/profesional/sede/motivo, año param); /api/company/outbox (GET cola + POST reintento si hay clave); /api/company/branding (GET ligero para cualquier usuario); avisos POST ahora audita y encola email; avisos/[id] PUT acepta seenAt ("now"/"clear", cualquier usuario con sesión) + auditoría en DELETE; profile PUT acepta brandColor + notifyEmail.
- D) DIARIOTAB: botón ⧉ DUPLICAR (toolbar, reabre modal con el último aviso: sede/pro/turno/motivo/nota, fecha=hoy); GUARDADO OPTIMISTA (tarjetas temporales al instante, sustitución por las reales del servidor, reversión + recarga si falla); MULTI-DÍA en el modal (chips de fechas con ✕, input date, atajos +1 día / +7 días); campo NOTA opcional en el modal.
- E) MENSUAL: botón ⤓ EXCEL (xlsx dinámico): hoja "Turnos M/AAAA" (matriz sedes × días con M/T y avisos marcados ⚠) + hoja "Avisos" del mes.
- F) USERVIEW: swipe táctil en tarjetas de aviso → marcar VISTO (PATCH seenAt; verde ✓ y atenuada); clic alterno en escritorio marca/desmarca; campana 🔔 con nº de avisos nuevos (hoy en adelante sin seenAt) que los marca todos.
- G) STATS: nueva sub-pestaña "📊 Datos" en DIARIO (StatsTab con recharts): avisos por mes (apilado M/T), por profesional (top 12), por sede, chips por motivo. Selector de año.
- H) CONFIG: OpsPanel desplegable "📮 Envíos de avisos y auditoría": pestaña Envíos (cola con estados sent/failed/pending + botón Reintentar si hay RESEND_API_KEY) y pestaña Auditoría (últimos eventos AVISO_CREATE/DELETE/SEEN con usuario y fecha).
- I) APPSHELL: toggle ☀️/🌙 tema claro (persistido en localStorage, html[data-theme="light"] sobrescribe superficies oscuras vía globals.css); logo corporativo (brand.logoUrl) y nombre en el navbar; color corporativo → var(--brand) + overrides CSS de los verdes del panel (bg-[#2E5D3A], bg-[#6BBE7A], bordes y gradientes) cuando data-brand=1. MI EMPRESA → Logo y Branding: input color + hex + campo "Email para avisos automáticos".
- J) Paridad móvil: verificadas vistas sm:hidden ya existentes en Sedes/Pros (tarjetas) y Calendarios (grid responsivo) — no requirió cambios.
- Animaciones: keyframes fadeIn/popIn en globals.css; aplicados a celdas de aviso y modales.
- K) BUILD ✓ (12.7s). Tests 68/0 + 6/0. Commit 9fadfe5 → Vercel READY. E2E producción:
  * /coche con cola de respuestas: voz "viernes" → 2·SEDE con echo "El viernes, 25 de septiembre" ✓; voz "23" → avanza ✓; flujo completo hasta 6·CONFIRMAR ✓ (sin motivo, como Task 32).
  * Panel: botón ⧉ Duplicar en toolbar ✓; sub-pestaña 📊 Datos con 3 gráficas recharts y "12 aviso(s) en 2026" ✓; ⤓ Excel junto a 🖨️ PDF en Mensual ✓; tema claro/oscuro conmuta html[data-theme] y fondo ✓; OpsPanel presente ✓; COLOR CORPORATIVO y EMAIL PARA AVISOS en MI EMPRESA ✓ (innerText en mayúsculas por clase uppercase).
  * API seenAt marcado/desmarcado sobre aviso real ✓ (quedó como estaba).
  * Capturas: download/stats-datos-tab.png.
- Nota despliegue: envío real de emails requiere añadir RESEND_API_KEY (y opcionalmente EMAIL_FROM) en Vercel → Settings → Environment Variables; sin clave, los envíos quedan "pending" visibles en Configuración.

Stage Summary:
- El Modo Coche deja elegir el día hablando libremente ("mañana", "viernes", "día 15", "23") sin depender de listas; el resto de pasos siguen con número/tap.
- Implementadas las 12 mejoras: duplicar, guardado optimista, multi-día, PWA campana, estadísticas, Excel, tema claro + animaciones, swipe visto, paridad móvil (ya existente), branding corporativo, email automático con cola, auditoría.
