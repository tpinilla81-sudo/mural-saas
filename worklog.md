---
Task ID: 5
Agent: main
Task: Validate step for diario salidas + 1 default línea as reference

Work Log:
- Updated sync route POST /api/company/bill/diario:
  * Items now created with status=PENDIENTE (was CUMPLIDA)
  * Same for manual creation mode
- New endpoint POST /api/company/bill/diario/[id]/validate:
  * Changes status PENDIENTE → CUMPLIDA
  * Creates 1 default línea as reference based on turn:
    - MANANA → c1="Servicios", c2="Mañana"
    - TARDE  → c1="Servicios", c2="Tarde"
  * Auto-resolves precio from catalog (client-specific first, then generic)
  * Uses obs="<professionalName> — <turn label>" so the auto-created line is identifiable
  * Idempotent on CUMPLIDA (returns existing state)
  * Rejects on FACTURADA (cannot re-validate)
  * If item already has líneas, doesn't add another default
- New endpoint POST /api/company/bill/diario/[id]/no-cumplida:
  * Marks status as NO_CUMPLIDA (the salida didn't happen)
  * NO_CUMPLIDA items are excluded from billing (cannot be transferred)
  * When transitioning from CUMPLIDA → NO_CUMPLIDA, removes the auto-created default line
    (matched by orden=0 + obs containing turn label)
- Updated PUT /api/company/bill/diario/[id] to reject edits on FACTURADA items
- Updated lineas POST and PUT to require status=CUMPLIDA
  (PENDIENTE/NO_CUMPLIDA must be validated first)
- Updated transfer route to reject non-CUMPLIDA items:
  * New notCumplida counter in response
  * Only CUMPLIDA items generate BillRegistros
- Updated DiarioView UI:
  * Status filter now has 4 options: Pendiente / Cumplida / No cumplida / Facturada
  * Color-coded badges: amber (pendiente), emerald (cumplida), rose (no cumplida), green (facturada)
  * Row actions per status:
    - PENDIENTE: ✓ Validate | ✗ No cumplida | Trash (delete)
    - CUMPLIDA: ListPlus (expand lineas) | Pencil (edit) | Trash (delete)
    - NO_CUMPLIDA / FACTURADA: — (no actions)
  * Only CUMPLIDA items can be expanded for línea editing (chevron hidden otherwise)
  * Only CUMPLIDA + PENDIENTE items can be selected (checkbox shown)
  * Bulk action bar shows separate buttons:
    - "Validar (N)" for selected PENDIENTE items (bulk validate via /validate per id)
    - "Pasar a facturar (N)" for selected CUMPLIDA items
  * Stats bar shows all 4 counts (pendientes/cumplidas/no cumplidas/facturadas)
  * No-cumplida items shown with reduced opacity (visual cue they're excluded)
  * Sync modal text updated: explains PENDIENTE flow + need to validate
  * Manual add modal info: explains item appears as PENDIENTE, needs validation
  * Transfer success message now includes notCumplida count when present
- Reset existing data: 118 items moved from CUMPLIDA → PENDIENTE, lineas cleared
  (so user can re-validate cleanly with the new flow)
- Build successful, pushed to GitHub/Vercel
- End-to-end test on production:
  * Verified items appear as PENDIENTE after sync
  * Tried to add línea to PENDIENTE item → got expected error
  * Validated an item → status=CUMPLIDA, 1 default línea created
    (Servicios/Mañana, 1x80€, obs="JULIO MURILLO — Mañana", precio from catalog)
  * Marked another item as NO_CUMPLIDA → excluded from billing
  * Tried to transfer NO_CUMPLIDA → notCumplida:1, transferred:0
  * Transferred CUMPLIDA → 1 registro created successfully

Stage Summary:
- Validate step added: syncs from Diario arrive as PENDIENTE (not assumed cumplido)
- User validates each salida: ✓ marks as cumplida + creates 1 default línea as reference
- If salida didn't happen: ✗ marks as NO_CUMPLIDA (excluded from billing, kept for audit)
- Only CUMPLIDA items can have lineas edited and be transferred to facturación
- Default línea: Servicios/Mañana or Servicios/Tarde based on turn, with precio from catalog
- Bulk validate available for selecting many PENDIENTE items at once
- Existing data reset so user can validate cleanly with new flow

---
Task ID: 6
Agent: main
Task: Update app logo with new image provided by user

Work Log:
- User uploaded /home/z/my-project/upload/IMG_5816.jpeg (920x919 JPEG, 106KB)
- Copied to /home/z/my-project/public/logo.jpeg (kept old logo.svg as backup)
- Updated all 4 references from /logo.svg → /logo.jpeg:
  * src/app/layout.tsx (favicon)
  * src/components/AppShell.tsx (loading splash + navbar top)
  * src/components/LoginForm.tsx (login card logo)
- Added `object-cover` class to all <img> tags so the new logo fills the
  circular/rounded container cleanly at all sizes
- Build successful, pushed to GitHub/Vercel (commit ac3975d)

Stage Summary:
- App logo replaced everywhere (login, navbar, splash, favicon)
- New logo is a JPEG auto-served by Next.js from /public/
- Old SVG kept on disk for fallback if needed
