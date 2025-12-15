# Feature F105: Password Reset Completion

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 11
- Complexity: Medium

## Purpose

Provides a secure password reset completion interface accessible via email token link. This feature allows users who have requested a password reset to set a new password by clicking a unique link sent to their email. The implementation includes token validation, expiration checks, password strength requirements, and secure password hashing.

## User Entry Points

| Type | Path            | Evidence                                   |
| ---- | --------------- | ------------------------------------------ |
| Page | /reset-password | `src/app/(auth)/reset-password/page.tsx:1` |

## Access Pattern

Users access this feature through:

1. Email link from password reset request (primary entry point)
2. Direct navigation with token parameter in URL: `/reset-password?token=xxx`

## Core Flow

1. User receives password reset email with unique token link → `src/lib/email/templates/password-reset-email.tsx:44-46`
2. User clicks reset link, landing on `/reset-password?token=xxx` → `src/app/(auth)/reset-password/page.tsx:27`
3. Page validates token presence in URL query parameters → `src/app/(auth)/reset-password/page.tsx:40-44`
4. User enters new password (minimum 8 characters) → `src/app/(auth)/reset-password/page.tsx:14-15`
5. User confirms password (must match) → `src/app/(auth)/reset-password/page.tsx:17-20`
6. Client-side validation ensures password requirements met → `src/app/(auth)/reset-password/page.tsx:36-38`
7. Form submission triggers `resetPassword` server action → `src/app/(auth)/reset-password/page.tsx:55`
8. Server validates token exists in database → `src/app/actions/auth.ts:175-182`
9. Server checks token hasn't expired (1-hour validity) → `src/app/actions/auth.ts:184-190`
10. Password hashed using bcrypt (10 rounds) → `src/app/actions/auth.ts:193`
11. User's password updated in database → `src/app/actions/auth.ts:196-199`
12. Used token deleted from database → `src/app/actions/auth.ts:202-204`
13. User redirected to login page with success parameter → `src/app/(auth)/reset-password/page.tsx:62`

## Key Modules

| Module            | Purpose                              | Location                                 |
| ----------------- | ------------------------------------ | ---------------------------------------- |
| ResetPasswordPage | UI form for setting new password     | `src/app/(auth)/reset-password/page.tsx` |
| resetPassword     | Server action to validate and update | `src/app/actions/auth.ts:172-211`        |
| AuthLayout        | Authentication page layout wrapper   | `src/app/(auth)/layout.tsx:1-9`          |
| Input             | Form input component with validation | Used in reset password form              |
| Button            | Submit button component              | Used in reset password form              |
| Card              | Card UI components for page layout   | Used for form container                  |

## Data

### Database Tables

**PasswordResetToken** → `prisma/schema.prisma:59-66`

| Field     | Type     | Description                              |
| --------- | -------- | ---------------------------------------- |
| id        | String   | Primary key (CUID)                       |
| token     | String   | Unique secure random token (32-byte hex) |
| userId    | String   | Reference to User.id                     |
| expiresAt | DateTime | Token expiration timestamp (1 hour)      |
| createdAt | DateTime | Token creation timestamp                 |

**Relations:**

- Belongs to `User` with cascade delete → `prisma/schema.prisma:65`
- Unique constraint on token field → `prisma/schema.prisma:61`

### Database Migration

Token table created in migration: `prisma/migrations/20251212_add_password_reset_token/migration.sql:1-16`

## Validation Rules

### Client-Side Validation

Implemented using Zod schema → `src/app/(auth)/reset-password/page.tsx:14-20`

| Field           | Validation Rule           | Error Message              |
| --------------- | ------------------------- | -------------------------- |
| password        | Minimum 8 characters      | "Lozinka mora imati..."    |
| confirmPassword | Must match password field | "Lozinke se ne podudaraju" |

### Server-Side Validation

| Check              | Location                          | Error Response                     |
| ------------------ | --------------------------------- | ---------------------------------- |
| Token exists       | `src/app/actions/auth.ts:180-182` | "Token je nevazeci ili je istekao" |
| Token not expired  | `src/app/actions/auth.ts:184-190` | "Token je istekao..."              |
| Password not empty | Client-side enforcement           | Prevented by form validation       |

## Security Features

### Token Security

1. **Cryptographically Secure Generation**
   - Uses Node.js crypto.randomBytes(32) → `src/app/actions/auth.ts:127-129`
   - 32-byte hex encoding provides 256 bits of entropy
   - Token stored with unique database constraint

2. **Time-Limited Validity**
   - 1-hour expiration from creation → `src/app/actions/auth.ts:131-133`
   - Expired tokens automatically rejected → `src/app/actions/auth.ts:184-190`
   - Expired tokens deleted when detected → `src/app/actions/auth.ts:186-189`

3. **Single-Use Tokens**
   - Token deleted immediately after successful password reset → `src/app/actions/auth.ts:202-204`
   - Prevents token reuse attacks

4. **Token Cleanup**
   - Old tokens for same user deleted when new token created → `src/app/actions/auth.ts:136-138`
   - Prevents multiple active tokens per user

### Password Security

1. **Bcrypt Hashing**
   - 10 salt rounds → `src/app/actions/auth.ts:193`
   - Industry-standard password hashing algorithm
   - Stored as `passwordHash` in User table

2. **Minimum Length Requirement**
   - 8 characters minimum → `src/app/(auth)/reset-password/page.tsx:15`
   - Enforced both client and server-side

### UI Security

1. **Token Validation on Load**
   - Immediate check if token present in URL → `src/app/(auth)/reset-password/page.tsx:40-44`
   - User-friendly error message if missing → `src/app/(auth)/reset-password/page.tsx:66-91`

2. **Error Messages**
   - Generic errors to prevent information leakage
   - Croatian language for user experience

## Error Handling

### Missing Token Scenarios

| Scenario            | Behavior                       | Evidence                                       |
| ------------------- | ------------------------------ | ---------------------------------------------- |
| No token in URL     | Show invalid link message      | `src/app/(auth)/reset-password/page.tsx:66-91` |
| Empty token         | Same as missing token          | `src/app/(auth)/reset-password/page.tsx:41-43` |
| User navigates away | Can request new reset via link | `src/app/(auth)/reset-password/page.tsx:81-86` |

### Token Validation Errors

| Scenario        | Server Response                  | User Message                       | Evidence                          |
| --------------- | -------------------------------- | ---------------------------------- | --------------------------------- |
| Token not found | `error: 'Token je nevazeci...'`  | "Token je nevazeci ili je istekao" | `src/app/actions/auth.ts:180-182` |
| Token expired   | `error: 'Token je istekao...'`   | "Token je istekao..."              | `src/app/actions/auth.ts:189`     |
| Database error  | `error: 'Doslo je do greske...'` | "Doslo je do greske..."            | `src/app/actions/auth.ts:209`     |

### Form Validation Errors

| Field           | Validation Failure     | Display Location             | Evidence                                         |
| --------------- | ---------------------- | ---------------------------- | ------------------------------------------------ |
| password        | Less than 8 chars      | Below password input         | `src/app/(auth)/reset-password/page.tsx:117`     |
| confirmPassword | Doesn't match password | Below confirm password input | `src/app/(auth)/reset-password/page.tsx:130`     |
| General error   | Server action fails    | Red banner above form        | `src/app/(auth)/reset-password/page.tsx:103-107` |

## User Experience

### Page States

1. **Loading State (Initial)**
   - Page loads with token validation
   - No loading spinner shown (instant check)

2. **Invalid Token State**
   - Card with error message displayed → `src/app/(auth)/reset-password/page.tsx:66-91`
   - Link to request new reset provided → `src/app/(auth)/reset-password/page.tsx:81-86`
   - "Zatrazi novo resetiranje" link goes to `/forgot-password`

3. **Valid Token State**
   - Form displayed with two password fields → `src/app/(auth)/reset-password/page.tsx:93-150`
   - Submit button enabled
   - Back to login link provided → `src/app/(auth)/reset-password/page.tsx:140-145`

4. **Submitting State**
   - Button shows "Resetiranje..." → `src/app/(auth)/reset-password/page.tsx:136`
   - Button disabled during submission → `src/app/(auth)/reset-password/page.tsx:135`
   - Form inputs remain enabled

5. **Success State**
   - Automatic redirect to `/login?reset=success` → `src/app/(auth)/reset-password/page.tsx:62`
   - No success message shown on reset page itself

6. **Error State**
   - Red error banner displayed → `src/app/(auth)/reset-password/page.tsx:103-107`
   - Button re-enabled for retry
   - User can modify password and resubmit

### Internationalization

All UI text in Croatian (Croatian language):

- Page title: "Nova lozinka"
- Button text: "Resetiraj lozinku"
- Field labels: "Nova lozinka", "Potvrdite lozinku"
- Error messages in Croatian
- Evidence: `src/app/(auth)/reset-password/page.tsx:96-145`

### Navigation Options

| Link Text                  | Destination      | Available When     | Evidence                                     |
| -------------------------- | ---------------- | ------------------ | -------------------------------------------- |
| "Povratak na prijavu"      | /login           | Always             | `src/app/(auth)/reset-password/page.tsx:144` |
| "Zatrazi novo resetiranje" | /forgot-password | Invalid token only | `src/app/(auth)/reset-password/page.tsx:82`  |

## Integration Points

### Dependencies

**Upstream Dependencies:**

1. Password reset request flow → `docs/02_FEATURES/features/auth-password-reset.md`
   - User must first request reset via `/forgot-password`
   - Token created and emailed by `requestPasswordReset` action
   - Email contains link to this page with token parameter

2. Email delivery system
   - Resend email service → `src/lib/email.ts:25-64`
   - Password reset email template → `src/lib/email/templates/password-reset-email.tsx:1-175`

3. Authentication system
   - User model with passwordHash field
   - Bcrypt password hashing
   - Session management for post-reset login

**Downstream Dependencies:**

1. Login page → `docs/02_FEATURES/features/auth-login.md`
   - Users redirected here after successful reset
   - Can use new password to authenticate

### External Services

**Resend Email Service** (Indirect - email already sent)

- Token link already delivered to user
- This page consumes the token from email

**Database** (Direct)

- Reads from PasswordResetToken table → `src/app/actions/auth.ts:175-177`
- Updates User.passwordHash → `src/app/actions/auth.ts:196-199`
- Deletes used token → `src/app/actions/auth.ts:202-204`

## Technical Implementation

### Frontend Components

**React Hook Form Integration**

- Form state management → `src/app/(auth)/reset-password/page.tsx:32-38`
- Zod resolver for validation → `src/app/(auth)/reset-password/page.tsx:37`
- Register inputs with validation → `src/app/(auth)/reset-password/page.tsx:118, 131`

**Next.js Features**

- Client component ("use client") → `src/app/(auth)/reset-password/page.tsx:1`
- useRouter for redirect → `src/app/(auth)/reset-password/page.tsx:25`
- useSearchParams for token extraction → `src/app/(auth)/reset-password/page.tsx:26-27`
- useEffect for initial validation → `src/app/(auth)/reset-password/page.tsx:40-44`

**State Management**

- Local state for error, loading → `src/app/(auth)/reset-password/page.tsx:29-30`
- Derived state for token presence → `src/app/(auth)/reset-password/page.tsx:27`

### Backend Implementation

**Server Action Pattern**

- "use server" directive → `src/app/actions/auth.ts:1`
- Async function export → `src/app/actions/auth.ts:172`
- Returns error or success object → `src/app/actions/auth.ts:181, 206`

**Database Operations**

1. Find token with user relation → `src/app/actions/auth.ts:175-178`
2. Validate expiration → `src/app/actions/auth.ts:184`
3. Update user password → `src/app/actions/auth.ts:196-199`
4. Delete token → `src/app/actions/auth.ts:202-204`

**Error Handling Pattern**

- Try-catch around all operations → `src/app/actions/auth.ts:173-210`
- Specific error messages for token issues
- Generic error for unexpected failures → `src/app/actions/auth.ts:208-209`

## Related Features

- **F102: Password Reset Request** → `docs/02_FEATURES/features/auth-password-reset.md`
  - Creates the token consumed by this feature
  - Sends email with reset link

- **F101: User Login** → `docs/02_FEATURES/features/auth-login.md`
  - Destination after successful password reset
  - Link provided on reset page for users who remember password

- **F106: Authentication Session Management** → `docs/02_FEATURES/features/auth-session.md`
  - Manages password hashing (bcrypt)
  - User model with passwordHash field

## Verification Checklist

- [x] User can access page via email link with token
- [x] Page validates token presence in URL
- [x] Missing token shows appropriate error message
- [x] Form validates password minimum length (8 chars)
- [x] Form validates password confirmation matches
- [x] Server validates token exists in database
- [x] Server validates token hasn't expired
- [x] Expired tokens are rejected with clear message
- [x] Password is hashed using bcrypt before storage
- [x] Token is deleted after successful use
- [x] User is redirected to login after success
- [x] Error messages are user-friendly (Croatian)
- [x] Loading states prevent double submission
- [x] Navigation links work correctly

## Evidence Links

1. **`src/app/(auth)/reset-password/page.tsx:1-151`** - Complete reset password page implementation with form, validation, and token handling
2. **`src/app/actions/auth.ts:172-211`** - resetPassword server action with token validation, expiration check, password update, and token cleanup
3. **`prisma/schema.prisma:59-66`** - PasswordResetToken database model with fields, constraints, and user relation
4. **`prisma/migrations/20251212_add_password_reset_token/migration.sql:1-16`** - Database migration creating PasswordResetToken table with indexes and foreign key
5. **`src/app/(auth)/layout.tsx:1-9`** - Authentication layout wrapper providing centered card design for reset password page
6. **`src/lib/email/templates/password-reset-email.tsx:44-46`** - Password reset email template showing reset link button that directs users to this page
7. **`docs/_meta/inventory/routes.json:378-381`** - Route registry entry confirming /reset-password page exists in (auth) route group
8. **`src/app/(auth)/reset-password/page.tsx:14-20`** - Zod validation schema for password requirements and confirmation matching
9. **`src/app/(auth)/reset-password/page.tsx:40-44`** - useEffect hook for immediate token validation on page load
10. **`src/app/actions/auth.ts:193`** - Bcrypt password hashing implementation with 10 salt rounds
11. **`src/app/(auth)/reset-password/page.tsx:62`** - Redirect to login page with success parameter after successful password reset
