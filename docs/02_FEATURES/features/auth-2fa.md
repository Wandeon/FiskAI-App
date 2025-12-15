# Feature: Passwordless Authentication (Passkeys/WebAuthn)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 12

## Purpose

This feature implements passwordless authentication using WebAuthn/Passkeys technology, allowing users to securely log in using biometric sensors (fingerprint, Face ID, Touch ID) or hardware security keys instead of traditional passwords. This is a modern alternative to traditional 2FA/TOTP, providing both security and convenience through FIDO2 standards.

**Note:** This system does NOT currently implement traditional TOTP-based 2FA with authenticator apps like Google Authenticator or Authy.

## User Entry Points

| Type | Path              | Evidence                                            |
| ---- | ----------------- | --------------------------------------------------- |
| Page | /settings         | `src/app/(dashboard)/settings/page.tsx:171-183`     |
| Page | /login (passkeys) | `src/app/(auth)/login/page.tsx:55-100`              |
| API  | /api/webauthn/\*  | `src/app/api/webauthn/register/start/route.ts:1-45` |

## Core Flow

### Registration Flow (Adding a Passkey)

1. User navigates to Settings > Security tab → `src/app/(dashboard)/settings/page.tsx:171-183`
2. PasskeyManager component loads existing passkeys → `src/components/settings/passkey-manager.tsx:35-45`
3. User clicks "Add passkey" button → `src/components/settings/passkey-manager.tsx:47-99`
4. System initiates registration via `/api/webauthn/register/start` → `src/app/api/webauthn/register/start/route.ts:6-44`
5. WebAuthn library generates registration options → `src/lib/webauthn.ts:86-113`
6. Browser prompts for biometric authentication → `src/components/settings/passkey-manager.tsx:68`
7. Registration response verified via `/api/webauthn/register/finish` → `src/app/api/webauthn/register/finish/route.ts:7-69`
8. Credential saved to database → `prisma/schema.prisma:771-782`

### Authentication Flow (Login with Passkey)

1. User enters email on login page → `src/app/(auth)/login/page.tsx:18-100`
2. System fetches user's registered passkeys via `/api/webauthn/login/start` → `src/app/api/webauthn/login/start/route.ts:5-53`
3. WebAuthn authentication options generated → `src/lib/webauthn.ts:148-166`
4. Browser prompts for biometric authentication → `src/app/(auth)/login/page.tsx:77-79`
5. Response verified via `/api/webauthn/login/finish` → `src/app/api/webauthn/login/finish/route.ts:6-98`
6. Session created using server action → `src/app/actions/auth.ts:213-239`
7. User redirected to dashboard → `src/app/(auth)/login/page.tsx:99-100`

## Key Modules

| Module              | Purpose                                    | Location                                        |
| ------------------- | ------------------------------------------ | ----------------------------------------------- |
| PasskeyManager      | UI for managing user's passkeys            | `src/components/settings/passkey-manager.tsx`   |
| webauthn library    | Core WebAuthn operations (generate/verify) | `src/lib/webauthn.ts`                           |
| Register Start API  | Initiate passkey registration              | `src/app/api/webauthn/register/start/route.ts`  |
| Register Finish API | Complete and verify passkey registration   | `src/app/api/webauthn/register/finish/route.ts` |
| Login Start API     | Initiate passkey authentication            | `src/app/api/webauthn/login/start/route.ts`     |
| Login Finish API    | Verify authentication and create session   | `src/app/api/webauthn/login/finish/route.ts`    |
| Passkeys List API   | Retrieve user's registered passkeys        | `src/app/api/webauthn/passkeys/route.ts`        |
| Delete Passkey API  | Remove a registered passkey                | `src/app/api/webauthn/passkeys/[id]/route.ts`   |
| Login Page          | Authentication UI with passkey support     | `src/app/(auth)/login/page.tsx`                 |
| Settings Page       | Security settings with passkey management  | `src/app/(dashboard)/settings/page.tsx`         |

## Data

- **Tables**: `WebAuthnCredential` → `prisma/schema.prisma:771-782`
- **Key fields**:
  - `credentialId` (String, unique) - Browser-generated credential identifier
  - `publicKey` (String) - Public key for verification
  - `counter` (BigInt) - Replay attack prevention counter
  - `transports` (String, nullable) - Supported transport methods (USB, NFC, BLE, internal)
  - `name` (String, nullable) - User-friendly name for the passkey
  - `lastUsedAt` (DateTime, nullable) - Last authentication timestamp
  - `userId` (String) - Foreign key to User table

## Dependencies

- **Depends on**:
  - User authentication system → [[auth-core]]
  - Session management (NextAuth)
- **Depended by**: None (optional authentication enhancement)

## Integrations

- **@simplewebauthn/server** → `src/lib/webauthn.ts:1-203` - Server-side WebAuthn operations
- **@simplewebauthn/browser** → `src/components/settings/passkey-manager.tsx:5` - Browser-side WebAuthn operations
- WebAuthn API (browser native) - FIDO2/WebAuthn standard compliance

## Configuration

Environment variables required:

- `WEBAUTHN_RP_ID` - Relying Party ID (default: 'erp.metrica.hr') → `src/lib/webauthn.ts:14`
- `WEBAUTHN_RP_NAME` - Relying Party Name (default: 'FiskAI') → `src/lib/webauthn.ts:15`
- `NEXTAUTH_URL` - Origin URL for WebAuthn → `src/lib/webauthn.ts:16`

## Security Features

1. **Challenge-based verification**: Temporary challenges stored with 5-minute TTL → `src/lib/webauthn.ts:18-57`
2. **Replay attack prevention**: Counter incremented on each use → `src/app/api/webauthn/login/finish/route.ts:69-76`
3. **User verification**: Biometric or PIN confirmation required
4. **Credential attestation**: Validates authenticator authenticity
5. **Transport flexibility**: Supports platform (Touch ID/Face ID) and cross-platform (USB keys) authenticators
6. **Cascade deletion**: Credentials automatically deleted when user is deleted → `prisma/schema.prisma:781`

## Browser Support Detection

The system checks for WebAuthn support on load:

```typescript
window?.PublicKeyCredential !== undefined && navigator?.credentials !== undefined
```

→ `src/components/settings/passkey-manager.tsx:26-29`

Unsupported browsers display a warning message → `src/components/settings/passkey-manager.tsx:135-144`

## Verification Checklist

- [x] User can register a new passkey from settings
- [x] User can view list of registered passkeys with creation dates
- [x] User can delete existing passkeys
- [x] User can log in using passkey from login page
- [x] System prevents duplicate credential registration
- [x] System validates challenge expiration (5 minutes)
- [x] System updates lastUsedAt timestamp on authentication
- [x] System increments counter to prevent replay attacks
- [x] Browser compatibility is checked before enabling features
- [x] User receives clear error messages on failure
- [x] Credentials are isolated per user (tenant isolation)
- [x] Passkey option is only shown for users with registered credentials

## Evidence Links

1. `src/components/settings/passkey-manager.tsx:1-212` - Complete passkey management UI
2. `src/lib/webauthn.ts:1-203` - WebAuthn core library implementation
3. `src/app/api/webauthn/register/start/route.ts:1-45` - Registration initiation endpoint
4. `src/app/api/webauthn/register/finish/route.ts:1-70` - Registration verification endpoint
5. `src/app/api/webauthn/login/start/route.ts:1-54` - Authentication initiation endpoint
6. `src/app/api/webauthn/login/finish/route.ts:1-99` - Authentication verification endpoint
7. `src/app/api/webauthn/passkeys/route.ts:1-36` - List passkeys endpoint
8. `src/app/api/webauthn/passkeys/[id]/route.ts:1-38` - Delete passkey endpoint
9. `src/app/(dashboard)/settings/page.tsx:171-183` - Security settings tab integration
10. `src/app/(auth)/login/page.tsx:55-100` - Login page with passkey support
11. `src/app/actions/auth.ts:213-239` - Passkey login server action
12. `prisma/schema.prisma:771-782` - WebAuthnCredential database model
