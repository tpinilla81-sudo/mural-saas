---
Task ID: 1
Agent: Super Z (main)
Task: Add Billing Module to MURAL Scheduling SaaS

Work Log:
- Updated Prisma schema: Added concept, taxRate, taxAmount, subtotal, periodStart, periodEnd, paidAt fields to Payment model. Added OVERDUE status. Added indexes on companyId, status, dueDate.
- Created 5 new API routes:
  - GET /api/company/billing - Company admin billing view (subscription, payments, usage stats)
  - GET/PUT/DELETE /api/admin/payments/[id] - Payment CRUD with status management
  - POST /api/admin/invoices/generate - Generate single invoice for a company
  - GET /api/admin/invoices/generate - Generate invoices for all active subscriptions
  - GET /api/admin/revenue - Revenue analytics (MRR, ARR, monthly breakdown, overdue)
- Created BillTab.tsx component for Company Admin with:
  - Current plan & subscription details card
  - Usage bars (professionals, sedes vs limits)
  - Billing summary (total paid, pending)
  - Invoice history table with detail modal
  - Plan comparison (BASIC/PRO/ENTERPRISE)
- Rewrote SuperAdminDashboard.tsx with 4 tabs:
  - EMPRESAS (existing, enhanced with invoice generation button per company)
  - FACTURACIÓN (KPI cards, revenue by method, recent payments with status management)
  - FACTURAS (full invoice management with filters, edit, delete, status changes)
  - INGRESOS (MRR/ARR, monthly revenue chart, by method, by plan, overdue alerts)
- Updated CompanyDashboard.tsx to include 💳 FACTURACIÓN tab
- Updated seed.ts with:
  - 7 monthly payments for MURAL (Jan-Jul 2026) with IVA calculations
  - 2nd company "Clínica Derma Plus" (BASIC/Quarterly)
  - 3rd company "Hospital Grupo Médico" (ENTERPRISE/Annual)
  - All payments include concept, taxRate (21%), taxAmount, subtotal, periodStart, periodEnd
- Fixed next.config.ts (removed standalone output that was causing server issues)
- Fixed revenue API (replaced 12 individual DB queries with single fetch + JS grouping)
- Tested and verified all features working

Stage Summary:
- Complete billing module added to the MURAL SaaS application
- Both Super Admin and Company Admin have billing views
- Invoice generation (manual and automatic) works
- Revenue analytics with MRR/ARR calculations
- Payment status management (mark as paid, overdue, refunded)
- IVA (21%) tax calculations on all invoices
- 3 demo companies with different plans and billing methods
- Demo credentials: admin@mural.app/admin123, mural@mural.app/mural123, derma@mural.app/derma123, grupo@mural.app/grupo123
