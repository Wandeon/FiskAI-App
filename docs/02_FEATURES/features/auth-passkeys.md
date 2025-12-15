# Feature: Passkey/WebAuthn Authentication

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 15

## Purpose

Enables passwordless authentication using WebAuthn/FIDO2 passkeys stored on user devices (biometric sensors, security keys, platform authenticators). Users can register multiple passkeys and login without entering passwords, improving security and user experience.

## User Entry Points

| Type | Path                   | Evidence                                        |
| ---- | ---------------------- | ----------------------------------------------- |
| Page | /settings?tab=security | `src/app/(dashboard)/settings/page.tsx:171-183` |
| Page | /login                 | `src/app/(auth)/login/page.tsx:18-238`          |

## Core Flow

### Registration Flow

1. User navigates to Settings > Security tab → `src/app/(dashboard)/settings/page.tsx:171`
2. PasskeyManager component loads existing passkeys → `src/components/settings/passkey-manager.tsx:35-45`
3. User clicks "Add passkey" button → `src/components/settings/passkey-manager.tsx:47-98`
4. Client initiates registration by calling `/api/webauthn/register/start` → `src/app/api/webauthn/register/start/route.ts:6-44`
5. Server generates registration options using SimpleWebAuthn → `src/lib/webauthn.ts:86-112`
6. Browser prompts for biometric/security key → `src/components/settings/passkey-manager.tsx:68`
7. Client sends registration response to `/api/webauthn/register/finish` → `src/app/api/webauthn/register/finish/route.ts:7-69`
8. Server verifies and stores credential in database → `src/lib/webauthn.ts:116-146`

### Login Flow

1. User navigates to /login and clicks "Sign in with passkey" → `src/app/(auth)/login/page.tsx:216-225`
2. User enters email address → `src/app/(auth)/login/page.tsx:134-146`
3. Client calls `/api/webauthn/login/start` with email → `src/app/api/webauthn/login/start/route.ts:5-53`
4. Server generates authentication options → `src/lib/webauthn.ts:148-165`
5. Browser prompts for biometric/security key → `src/app/(auth)/login/page.tsx:77`
6. Client sends authentication response to `/api/webauthn/login/finish` → `src/app/api/webauthn/login/finish/route.ts:6-98`
7. Server verifies credential and updates counter → `src/lib/webauthn.ts:169-201`
8. Server creates session using loginWithPasskey action → `src/app/actions/auth.ts:213-239`

## Key Modules

| Module           | Purpose                                            | Location                                        |
| ---------------- | -------------------------------------------------- | ----------------------------------------------- |
| PasskeyManager   | UI for managing registered passkeys                | `src/components/settings/passkey-manager.tsx`   |
| webauthn.ts      | Core WebAuthn logic (registration/authentication)  | `src/lib/webauthn.ts`                           |
| register/start   | API endpoint to initiate passkey registration      | `src/app/api/webauthn/register/start/route.ts`  |
| register/finish  | API endpoint to complete passkey registration      | `src/app/api/webauthn/register/finish/route.ts` |
| login/start      | API endpoint to initiate passkey authentication    | `src/app/api/webauthn/login/start/route.ts`     |
| login/finish     | API endpoint to complete passkey authentication    | `src/app/api/webauthn/login/finish/route.ts`    |
| passkeys GET     | API endpoint to list user's passkeys               | `src/app/api/webauthn/passkeys/route.ts`        |
| passkeys DELETE  | API endpoint to delete a specific passkey          | `src/app/api/webauthn/passkeys/[id]/route.ts`   |
| loginWithPasskey | Server action to create session after verification | `src/app/actions/auth.ts:213-239`               |

## Data

- **Tables**: `WebAuthnCredential` → `prisma/schema.prisma:771`
- **Key fields**:
  - `id` (String, primary key)
  - `userId` (String, foreign key to User)
  - `credentialId` (String, unique, base64url-encoded credential ID)
  - `publicKey` (String, base64-encoded public key)
  - `counter` (BigInt, signature counter for replay protection)
  - `transports` (String?, JSON array of authenticator transports)
  - `name` (String?, user-friendly name)
  - `createdAt` (DateTime, creation timestamp)
  - `lastUsedAt` (DateTime?, last successful authentication)

## Dependencies

- **Depends on**: [[auth-sessions]] - Uses NextAuth session management after successful passkey verification
- **Depended by**: None

## Integrations

- **SimpleWebAuthn library** → `src/lib/webauthn.ts:1-6` - Handles WebAuthn protocol implementation
  - `@simplewebauthn/server` for server-side verification
  - `@simplewebauthn/browser` for client-side credential creation/retrieval
- **Environment variables**:
  - `WEBAUTHN_RP_ID` - Relying Party ID (defaults to "erp.metrica.hr") → `src/lib/webauthn.ts:14`
  - `WEBAUTHN_RP_NAME` - Relying Party Name (defaults to "FiskAI") → `src/lib/webauthn.ts:15`
  - `NEXTAUTH_URL` - Expected origin for credential verification → `src/lib/webauthn.ts:16`

## Security Features

1. **Challenge storage** - In-memory challenge store with 5-minute TTL → `src/lib/webauthn.ts:18-57`
2. **Signature counter** - Prevents replay attacks by tracking authentication counter → `src/lib/webauthn.ts:142,200`
3. **User verification** - Supports platform authenticators with biometric verification → `src/lib/webauthn.ts:106,161`
4. **Credential exclusion** - Prevents duplicate credential registration → `src/lib/webauthn.ts:98-103`
5. **Browser support detection** - Checks PublicKeyCredential availability → `src/components/settings/passkey-manager.tsx:26-29`

## Verification Checklist

- [x] User can register a new passkey from Settings > Security
- [x] User can view list of registered passkeys with creation/usage dates
- [x] User can delete an existing passkey
- [x] User can login using passkey from /login page
- [x] System updates lastUsedAt timestamp on successful authentication
- [x] System updates signature counter on each authentication
- [x] Passkeys are scoped to user account (cascade delete on user deletion)
- [x] Browser compatibility check displays warning for unsupported browsers
- [x] Multiple passkeys can be registered per user
- [x] User-friendly names are assigned to passkeys

## Evidence Links

1. `src/components/settings/passkey-manager.tsx:1-211` - Complete passkey management UI component
2. `src/lib/webauthn.ts:1-203` - Core WebAuthn registration and authentication logic
3. `src/app/api/webauthn/register/start/route.ts:1-44` - Registration initiation endpoint
4. `src/app/api/webauthn/register/finish/route.ts:1-69` - Registration completion endpoint
5. `src/app/api/webauthn/login/start/route.ts:1-53` - Authentication initiation endpoint
6. `src/app/api/webauthn/login/finish/route.ts:1-98` - Authentication completion endpoint
7. `src/app/api/webauthn/passkeys/route.ts:1-35` - List passkeys endpoint
8. `src/app/api/webauthn/passkeys/[id]/route.ts:1-37` - Delete passkey endpoint
9. `src/app/(auth)/login/page.tsx:55-114` - Passkey login flow in login page
10. `src/app/(dashboard)/settings/page.tsx:171-183` - Security tab with PasskeyManager
11. `src/app/actions/auth.ts:213-239` - loginWithPasskey server action
12. `prisma/schema.prisma:771-782` - WebAuthnCredential database model
13. `prisma/schema.prisma:21` - User.webAuthnCredentials relation
14. `src/app/(auth)/login/page.tsx:216-225` - Passkey login button UI
15. `src/components/settings/passkey-manager.tsx:135-144` - Unsupported browser warning
