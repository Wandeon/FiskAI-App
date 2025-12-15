# Feature: User Login

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 12

## Purpose

Allows users to authenticate and access the FiskAI application using email/password credentials or passkey (WebAuthn) authentication. Includes rate limiting for security and supports password recovery flow.

## User Entry Points

| Type | Path                    | Evidence                                    |
| ---- | ----------------------- | ------------------------------------------- |
| Page | /login                  | `src/app/(auth)/login/page.tsx:1`           |
| API  | /api/auth/[...nextauth] | `src/app/api/auth/[...nextauth]/route.ts:1` |

## Core Flow

### Standard Login Flow

1. User navigates to /login page -> `src/app/(auth)/login/page.tsx:18`
2. User enters email and password -> `src/app/(auth)/login/page.tsx:170-207`
3. Form validation using Zod schema -> `src/lib/validations/auth.ts:3-6`
4. Rate limiting check applied -> `src/lib/security/rate-limit.ts:34-95`
5. Login action called with credentials -> `src/app/actions/auth.ts:61-98`
6. NextAuth signIn with credentials provider -> `src/lib/auth.ts:18-82`
7. Password verification using bcrypt -> `src/lib/auth.ts:64-72`
8. JWT token created and session established -> `src/lib/auth.ts:93-104`
9. User redirected to /dashboard -> `src/app/actions/auth.ts:97`

### Passkey Login Flow

1. User clicks "Prijava s passkey" button -> `src/app/(auth)/login/page.tsx:216-225`
2. User enters email address -> `src/app/(auth)/login/page.tsx:123-147`
3. Start WebAuthn authentication -> `src/app/api/webauthn/login/start/route.ts:5-53`
4. Browser prompts for biometric/security key -> `src/app/(auth)/login/page.tsx:77-79`
5. Verify authentication response -> `src/app/api/webauthn/login/finish/route.ts:6-98`
6. Create session using passkey credential -> `src/app/actions/auth.ts:213-239`
7. User redirected to /dashboard -> `src/app/(auth)/login/page.tsx:100-101`

## Key Modules

| Module              | Purpose                                     | Location                                     |
| ------------------- | ------------------------------------------- | -------------------------------------------- |
| LoginPage           | Main login UI with forms and state          | `src/app/(auth)/login/page.tsx`              |
| login action        | Server action for credential authentication | `src/app/actions/auth.ts:61-98`              |
| loginWithPasskey    | Server action for passkey authentication    | `src/app/actions/auth.ts:213-239`            |
| NextAuth config     | Authentication provider configuration       | `src/lib/auth.ts:9-116`                      |
| CredentialsProvider | Email/password authentication handler       | `src/lib/auth.ts:18-82`                      |
| loginSchema         | Zod validation schema for login form        | `src/lib/validations/auth.ts:3-6`            |
| checkRateLimit      | Rate limiting for security                  | `src/lib/security/rate-limit.ts:34-95`       |
| WebAuthn Start API  | Initiates passkey authentication            | `src/app/api/webauthn/login/start/route.ts`  |
| WebAuthn Finish API | Verifies passkey authentication             | `src/app/api/webauthn/login/finish/route.ts` |
| AuthLayout          | Centered layout for auth pages              | `src/app/(auth)/layout.tsx:3-9`              |

## Data

### Database Tables

- **User**: Stores user accounts -> `prisma/schema.prisma:9-23`
  - Key fields: id, email, passwordHash, emailVerified, createdAt

- **Session**: JWT session storage -> `prisma/schema.prisma:43-48`
  - Key fields: sessionToken, userId, expires

- **Account**: OAuth provider accounts -> `prisma/schema.prisma:25-39`
  - Key fields: provider, providerAccountId, access_token

- **WebAuthnCredential**: Passkey credentials -> `prisma/schema.prisma:771-781`
  - Key fields: userId, credentialId, publicKey, counter, transports

- **PasswordResetToken**: Password reset tokens -> `prisma/schema.prisma:59-65`
  - Key fields: token, userId, expiresAt

## Security Features

### Rate Limiting

- **Login attempts**: 5 attempts per 15 minutes -> `src/lib/security/rate-limit.ts:14-18`
- **Block duration**: 1 hour after max attempts -> `src/lib/security/rate-limit.ts:17`
- **Implementation**: In-memory store with automatic cleanup -> `src/lib/security/rate-limit.ts:10-118`
- **Applied at**: Action level and auth provider level -> `src/app/actions/auth.ts:70-77` and `src/lib/auth.ts:29-36`

### Password Security

- **Hashing**: bcrypt with salt rounds 10 -> `src/app/actions/auth.ts:29`
- **Validation**: Min 8 chars, uppercase, number required -> `src/lib/validations/auth.ts:11-15`
- **Comparison**: Constant-time bcrypt compare -> `src/lib/auth.ts:64-67`

### Session Security

- **Strategy**: JWT tokens -> `src/lib/auth.ts:11`
- **Adapter**: Prisma for session storage -> `src/lib/auth.ts:10`
- **Callbacks**: User ID stored in token -> `src/lib/auth.ts:93-104`

## Dependencies

- **Depends on**: None (entry point to application)
- **Depended by**: All authenticated features (dashboard, invoices, etc.)

## Integrations

### NextAuth.js

- NextAuth v5 authentication library -> `src/lib/auth.ts:1`
- Prisma adapter integration -> `src/lib/auth.ts:2-10`
- Credentials provider for email/password -> `src/lib/auth.ts:18-82`
- Google OAuth provider (optional) -> `src/lib/auth.ts:83-90`

### WebAuthn (Passkeys)

- SimpleWebAuthn library for passkey support -> `src/app/(auth)/login/page.tsx:13-14`
- Browser WebAuthn API detection -> `src/app/(auth)/login/page.tsx:27-33`
- Credential storage in database -> `prisma/schema.prisma:771-781`

### Form Validation

- react-hook-form for form state -> `src/app/(auth)/login/page.tsx:6`
- Zod resolver for schema validation -> `src/app/(auth)/login/page.tsx:7-8`

## UI Components

- **Card, CardHeader, CardTitle, CardContent**: UI components for login form container
- **Input**: Form input with error handling
- **Button**: Primary and ghost variants for actions
- **KeyRound icon**: Passkey button icon from lucide-react

## Error Handling

- **Invalid credentials**: Generic error message to prevent enumeration -> `src/app/actions/auth.ts:89`
- **Rate limit exceeded**: Returns "Invalid credentials" to hide rate limiting -> `src/app/actions/auth.ts:76`
- **Network errors**: Caught and displayed to user -> `src/app/(auth)/login/page.tsx:49-52`
- **Passkey errors**: Specific handling for NotAllowedError -> `src/app/(auth)/login/page.tsx:104-110`

## Verification Checklist

- [x] User can log in with valid email/password
- [x] User cannot log in with invalid credentials
- [x] Rate limiting prevents brute force attacks
- [x] User can log in with passkey (if registered)
- [x] User can request password reset
- [x] Sessions persist across page refreshes
- [x] User is redirected to dashboard after login
- [x] Form validation prevents invalid submissions
- [x] Error messages are user-friendly and secure
- [x] Passkey authentication works on supported devices

## Related Features

- **Password Reset**: `src/app/(auth)/forgot-password/page.tsx` and `src/app/(auth)/reset-password/page.tsx`
- **User Registration**: `src/app/(auth)/register/page.tsx`
- **Logout**: `src/app/actions/auth.ts:100-103`
- **Passkey Management**: `src/components/settings/passkey-manager.tsx`

## Evidence Links

1. `src/app/(auth)/login/page.tsx:1-238` - Main login page component with email/password and passkey flows
2. `src/app/actions/auth.ts:61-98` - Login server action with rate limiting and credential validation
3. `src/app/actions/auth.ts:213-239` - Passkey login server action
4. `src/lib/auth.ts:9-116` - NextAuth configuration with credentials provider
5. `src/lib/auth.ts:18-82` - Credentials provider authorization logic with bcrypt verification
6. `src/lib/validations/auth.ts:3-6` - Login form validation schema
7. `src/lib/security/rate-limit.ts:34-95` - Rate limiting implementation
8. `src/app/api/webauthn/login/start/route.ts:5-53` - WebAuthn authentication start endpoint
9. `src/app/api/webauthn/login/finish/route.ts:6-98` - WebAuthn authentication finish endpoint
10. `src/app/(auth)/layout.tsx:3-9` - Auth pages layout wrapper
11. `prisma/schema.prisma:9-23` - User model definition
12. `prisma/schema.prisma:771-781` - WebAuthnCredential model definition
