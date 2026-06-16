# Task: Create Bill by Método API Routes

## Summary
Created 6 API route files for the Bill by Método billing module in the Mural SaaS app.

## Files Created

1. **`/src/app/api/company/bill/clientes/route.ts`**
   - `GET` — List all clients for the company, ordered by nombre asc
   - `POST` — Create single client or batch (array). Validates nombre required, companyId ownership

2. **`/src/app/api/company/bill/catalogo/route.ts`**
   - `GET` — List all catalog items ordered by c1,c2. Optional `?clienteId=` filter (includes generic items)
   - `POST` — Create single item or batch. Validates c1/c2 required, clienteId ownership

3. **`/src/app/api/company/bill/registros/route.ts`**
   - `GET` — List registros with filters: `?filter=entrada|registros|all`, `?clienteId=`, `?from=`, `?to=`
   - `POST` — Create single or batch registros. Auto-lookup: client name from BillCliente, unit price from BillCatalogo (client-specific first, then generic fallback)

4. **`/src/app/api/company/bill/registros/transfer/route.ts`**
   - `POST` — Mark all un-transferred registros as `pasadoRegistro=true`. Optional `?before=YYYY-MM-DD`

5. **`/src/app/api/company/bill/config/route.ts`**
   - `GET` — Return BillConfig, auto-create with defaults if missing
   - `PUT` — Upsert BillConfig with allowlisted fields only

6. **`/src/app/api/company/bill/factura-seq/route.ts`**
   - `GET` — Return current seq, auto-create with seq=1 if missing
   - `PUT` — Upsert seq value with validation (positive integer)

## Patterns Used
- All routes use `requireCompanyAdmin()` for auth
- All routes use `db` from `@/lib/db`
- All routes validate `companyId` ownership
- Consistent error handling with proper status codes
- Batch support via array body for clientes, catalogo, registros
- Auto-lookup logic for registros (client name, catalog pricing)

## Lint Result
0 errors, 2 pre-existing warnings (unrelated MensualTab.tsx)
