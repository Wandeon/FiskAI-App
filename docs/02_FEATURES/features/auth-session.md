# Feature: Session Management

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 12

## Purpose

Manages user authentication sessions using NextAuth.js with JWT strategy, providing secure stateless session management for authenticated users across the application. Handles session creation, validation, and lifecycle management for login, logout, and protected route access.

## User Entry Points

| Type       | Path                    | Evidence                                    |
| ---------- | ----------------------- | ------------------------------------------- |
| API        | /api/auth/[...nextauth] | `src/app/api/auth/[...nextauth]/route.ts:1` |
| Page       | /login                  | `src/app/(auth)/login/page.tsx:1`           |
| Middleware | All routes              | `src/middleware.ts:5`                       |

## Core Flow

1. User authenticates via credentials or OAuth → `src/lib/auth.ts:18-82`
2. NextAuth creates JWT session token → `src/lib/auth.ts:11`
3. Session token stored in HTTP-only cookie (NextAuth default behavior)
4. Protected routes check session using `auth()` helper → `src/app/(dashboard)/layout.tsx:15`
5. Session data includes user ID via JWT callback → `src/lib/auth.ts:93-104`
6. Server actions and API routes validate session → `src/lib/auth-utils.ts:7-10`
7. User logs out via signOut() action → `src/app/actions/auth.ts:100-103`
8. Session events logged for audit trail → `src/lib/auth.ts:106-115`

## Key Modules

| Module             | Purpose                                   | Location                                  |
| ------------------ | ----------------------------------------- | ----------------------------------------- |
| NextAuth Config    | Main auth configuration with JWT strategy | `src/lib/auth.ts`                         |
| Auth Route Handler | NextAuth API route handlers               | `src/app/api/auth/[...nextauth]/route.ts` |
| Auth Utilities     | Helper functions for session access       | `src/lib/auth-utils.ts`                   |
| Login Page         | User login interface                      | `src/app/(auth)/login/page.tsx`           |
| Auth Actions       | Server actions for login/logout           | `src/app/actions/auth.ts`                 |
| Dashboard Layout   | Session validation for protected routes   | `src/app/(dashboard)/layout.tsx`          |
| Middleware         | Request logging (no auth enforcement)     | `src/middleware.ts`                       |
| Rate Limiter       | Login attempt rate limiting               | `src/lib/security/rate-limit.ts`          |

## Data

- **Tables**: `Session` → `prisma/schema.prisma:43-48`, `User` → `prisma/schema.prisma:9-23`, `Account` → `prisma/schema.prisma:25-40`
- **Key fields**:
  - Session: `sessionToken` (unique), `userId`, `expires`
  - User: `id`, `email`, `passwordHash`, `emailVerified`
  - Account: OAuth provider accounts linked to users

## Technical Implementation

### Session Strategy

- **Type**: JWT (stateless)
- **Storage**: HTTP-only cookies (NextAuth default)
- **Configuration**: `src/lib/auth.ts:11` sets `session: { strategy: "jwt" }`
- **Token Contents**: User ID is injected via JWT callback → `src/lib/auth.ts:93-98`

### Authentication Providers

1. **Credentials Provider** → `src/lib/auth.ts:18-82`
   - Email/password authentication with bcrypt
   - Rate limiting: 5 attempts per 15 minutes → `src/lib/auth.ts:29-36`
   - Passkey support via special token format → `src/lib/auth.ts:40-54`

2. **Google OAuth** (conditional) → `src/lib/auth.ts:83-90`
   - Enabled if environment variables present
   - Uses PrismaAdapter for account linking

### Session Access Patterns

**Server Components**:

```typescript
const session = await auth()
if (!session?.user) redirect("/login")
```

Evidence: `src/app/(dashboard)/layout.tsx:15-19`

**API Routes**:

```typescript
const user = await getCurrentUser()
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
```

Evidence: `src/app/api/capabilities/route.ts:6-10`

**Server Actions**:

```typescript
const user = await requireAuth()
```

Evidence: `src/lib/auth-utils.ts:12-18`

### Session Callbacks

**JWT Callback** → `src/lib/auth.ts:93-98`

- Runs when JWT is created or updated
- Adds user.id to token for session access

**Session Callback** → `src/lib/auth.ts:99-104`

- Runs when session is accessed
- Transfers token.id to session.user.id

### Security Features

1. **Rate Limiting** → `src/lib/security/rate-limit.ts:13-29`
   - Login: 5 attempts per 15 minutes, 1 hour block
   - Password Reset: 3 attempts per 15 minutes, 1 hour block
   - In-memory store (production should use Redis)

2. **Password Security** → `src/lib/auth.ts:64-72`
   - bcrypt hashing with salt rounds of 10
   - Secure comparison to prevent timing attacks

3. **Audit Logging** → `src/lib/auth.ts:106-115`
   - Sign-in events logged with user email
   - Sign-out events logged with token email
   - Ready for production audit log integration

### Auth Utility Functions

| Function                         | Purpose                                     | Evidence                        |
| -------------------------------- | ------------------------------------------- | ------------------------------- |
| `getCurrentUser()`               | Get current session user                    | `src/lib/auth-utils.ts:7-10`    |
| `requireAuth()`                  | Require auth or redirect to login           | `src/lib/auth-utils.ts:12-18`   |
| `getCurrentCompany(userId)`      | Get user's default company                  | `src/lib/auth-utils.ts:20-41`   |
| `requireCompany(userId)`         | Require company or redirect to onboarding   | `src/lib/auth-utils.ts:43-49`   |
| `requireCompanyWithContext()`    | Auth + company + tenant context wrapper     | `src/lib/auth-utils.ts:75-89`   |
| `requireCompanyWithPermission()` | Auth + company + permission check + context | `src/lib/auth-utils.ts:118-136` |

## Dependencies

- **Depends on**:
  - NextAuth.js v5 (authentication framework)
  - Prisma (database adapter, User/Session/Account models)
  - bcryptjs (password hashing)

- **Depended by**:
  - All protected routes and API endpoints
  - [[rbac]] (Role-Based Access Control)
  - [[tenant-isolation]] (Multi-tenant data isolation)
  - [[audit-logging]] (Security event tracking)

## Integrations

- **NextAuth.js** → `src/lib/auth.ts:1`
  - Core authentication library
  - JWT session strategy
  - OAuth provider support

- **Prisma Adapter** → `src/lib/auth.ts:2,10`
  - Database adapter for NextAuth
  - Manages User, Account, Session tables

- **Google OAuth** → `src/lib/auth.ts:4,85-88`
  - Optional OAuth provider
  - Configured via environment variables

- **Rate Limiting** → `src/lib/security/rate-limit.ts:1`
  - Login attempt protection
  - Account security enforcement

## Verification Checklist

- [x] User can log in with email/password
- [x] User can log in with passkey (WebAuthn)
- [x] User can log in with Google OAuth (if configured)
- [x] Session persists across page refreshes
- [x] Protected routes redirect unauthenticated users to login
- [x] Session includes user ID for authorization checks
- [x] User can log out successfully
- [x] Rate limiting blocks excessive login attempts
- [x] Failed login attempts don't leak user existence
- [x] Session events are logged for audit
- [x] Password reset tokens have expiration
- [x] JWT tokens are HTTP-only and secure

## Known Limitations

1. **In-memory rate limiting** → `src/lib/security/rate-limit.ts:11`
   - Not suitable for multi-instance deployments
   - Should use Redis in production

2. **Session table unused** → `prisma/schema.prisma:43-48`
   - JWT strategy doesn't use database Session table
   - Table exists for potential database session strategy migration

3. **No session refresh mechanism**
   - JWT sessions don't have explicit refresh logic
   - Relies on NextAuth default token expiration

4. **Audit events only logged to console** → `src/lib/auth.ts:109,113`
   - Production should integrate with proper audit log system

## Evidence Links

1. `src/lib/auth.ts:1-116` - Complete NextAuth configuration with JWT strategy, providers, and callbacks
2. `src/app/api/auth/[...nextauth]/route.ts:1-3` - NextAuth API route handlers
3. `src/app/actions/auth.ts:61-103` - Login and logout server actions with rate limiting
4. `src/lib/auth-utils.ts:1-136` - Session access utilities and auth helpers
5. `src/app/(dashboard)/layout.tsx:15-19` - Session validation in protected layout
6. `src/app/(auth)/login/page.tsx:1-238` - Login page with credential and passkey auth
7. `src/lib/security/rate-limit.ts:1-118` - Rate limiting implementation for login protection
8. `prisma/schema.prisma:9-23` - User model with session relations
9. `prisma/schema.prisma:43-48` - Session model for NextAuth
10. `prisma/schema.prisma:25-40` - Account model for OAuth providers
11. `src/app/api/capabilities/route.ts:1-20` - Example API route using session validation
12. `src/middleware.ts:1-33` - Request logging middleware (non-blocking)
