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
