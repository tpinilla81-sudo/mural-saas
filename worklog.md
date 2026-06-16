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
