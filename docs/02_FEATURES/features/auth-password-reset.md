# Feature: Password Reset

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 11

## Purpose

Allows users to securely reset their forgotten password via email verification. The feature implements security best practices including rate limiting, token expiration, and protection against email enumeration attacks.

## User Entry Points

| Type | Path             | Evidence                                    |
| ---- | ---------------- | ------------------------------------------- |
| Page | /forgot-password | `src/app/(auth)/forgot-password/page.tsx:1` |
| Page | /reset-password  | `src/app/(auth)/reset-password/page.tsx:1`  |
| Link | Login page       | `src/app/(auth)/login/page.tsx:200`         |

## Core Flow

1. User clicks "Zaboravljena lozinka?" link on login page → `src/app/(auth)/login/page.tsx:200`
2. User enters email address in forgot password form → `src/app/(auth)/forgot-password/page.tsx:34`
3. Server action validates request and checks rate limits → `src/app/actions/auth.ts:105-170`
4. System generates secure random token (32 bytes hex) → `src/app/actions/auth.ts:127-129`
5. Token stored in database with 1-hour expiration → `src/app/actions/auth.ts:141-147`
6. Password reset email sent with unique link → `src/app/actions/auth.ts:150-162`
7. User clicks reset link, landing on /reset-password?token=xxx → `src/app/(auth)/reset-password/page.tsx:27`
8. User enters new password (minimum 8 characters) → `src/app/(auth)/reset-password/page.tsx:14-20`
9. Server validates token and expiration → `src/app/actions/auth.ts:174-190`
10. Password hashed (bcrypt) and updated in database → `src/app/actions/auth.ts:193-199`
11. Used token deleted, user redirected to login → `src/app/actions/auth.ts:201-206`

## Key Modules

| Module               | Purpose                                 | Location                                           |
| -------------------- | --------------------------------------- | -------------------------------------------------- |
| ForgotPasswordPage   | UI form for requesting password reset   | `src/app/(auth)/forgot-password/page.tsx`          |
| ResetPasswordPage    | UI form for setting new password        | `src/app/(auth)/reset-password/page.tsx`           |
| requestPasswordReset | Server action to create reset token     | `src/app/actions/auth.ts:105-170`                  |
| resetPassword        | Server action to validate and reset     | `src/app/actions/auth.ts:172-211`                  |
| PasswordResetEmail   | Email template with reset link          | `src/lib/email/templates/password-reset-email.tsx` |
| sendEmail            | Email delivery via Resend service       | `src/lib/email.ts:25-64`                           |
| checkRateLimit       | Rate limiting protection (3 per 15 min) | `src/lib/security/rate-limit.ts:34-95`             |

## Data

- **Tables**: `PasswordResetToken` → `prisma/schema.prisma:59-66`
- **Key fields**:
  - `token` (String, unique): Secure random token for password reset
  - `userId` (String): Reference to user requesting reset
  - `expiresAt` (DateTime): Token expiration timestamp (1 hour from creation)
  - `createdAt` (DateTime): Token creation timestamp
- **Relations**: Belongs to `User` with cascade delete

## Security Features

### Rate Limiting

- **Configuration**: `src/lib/security/rate-limit.ts:19-23`
- **Limits**: 3 attempts per 15 minutes per email
- **Block Duration**: 1 hour after exceeding limit
- **Protection**: Prevents brute force attacks and abuse

### Anti-Enumeration

- **Implementation**: `src/app/actions/auth.ts:111-123`
- **Behavior**: Always returns success message regardless of whether email exists
- **Purpose**: Prevents attackers from discovering valid email addresses

### Token Security

- **Generation**: Cryptographically secure random 32-byte token → `src/app/actions/auth.ts:127-129`
- **Expiration**: 1 hour validity → `src/app/actions/auth.ts:131-133`
- **Single-use**: Token deleted after successful reset → `src/app/actions/auth.ts:201-204`
- **Validation**: Checks existence and expiration before accepting → `src/app/actions/auth.ts:175-190`

## Dependencies

- **Depends on**:
  - [[auth-session-management]] - For password hashing (bcrypt) and user authentication
  - Email service infrastructure (Resend)
- **Depended by**:
  - [[auth-login]] - Links to forgot password functionality

## Integrations

- **Resend Email Service** → `src/lib/email.ts:1-65`
  - API Key: `RESEND_API_KEY` environment variable
  - From Email: `RESEND_FROM_EMAIL` or defaults to `noreply@fiskai.app`
  - Template: React Email components for styled emails

- **Prisma Database** → `prisma/schema.prisma:59-66`
  - PasswordResetToken model with user relation
  - Cascade delete when user is deleted

- **Crypto Module** → `src/app/actions/auth.ts:127`
  - Node.js built-in crypto for secure random token generation

## Email Template Details

The password reset email (`src/lib/email/templates/password-reset-email.tsx`) includes:

- Personalized greeting with user name
- Clear reset button with secure link
- Plain text link as backup
- Warning box highlighting:
  - 1-hour expiration time
  - Advice to ignore if not requested
  - Assurance password unchanged until link clicked
- Professional footer with FiskAI branding

## Error Handling

| Scenario                  | Behavior                                   | Evidence                                       |
| ------------------------- | ------------------------------------------ | ---------------------------------------------- |
| Email not found           | Returns success (anti-enumeration)         | `src/app/actions/auth.ts:121-124`              |
| Rate limit exceeded       | Returns success (anti-enumeration)         | `src/app/actions/auth.ts:110-113`              |
| Token expired             | Shows error, prompts new request           | `src/app/actions/auth.ts:184-190`              |
| Token not found           | Shows error message                        | `src/app/actions/auth.ts:180-182`              |
| Missing token in URL      | Shows invalid link message                 | `src/app/(auth)/reset-password/page.tsx:41-43` |
| Email service unavailable | Still returns success to user              | `src/app/actions/auth.ts:165-169`              |
| Password validation fails | Client-side validation prevents submission | `src/app/(auth)/reset-password/page.tsx:14-20` |

## Validation Rules

### Forgot Password Form

- **Email**: Must be valid email format → `src/app/(auth)/forgot-password/page.tsx:14`

### Reset Password Form

- **Password**: Minimum 8 characters → `src/app/(auth)/reset-password/page.tsx:15`
- **Confirm Password**: Must match password → `src/app/(auth)/reset-password/page.tsx:17-20`

## User Experience

### Success States

- Forgot password: Green success banner with instructions → `src/app/(auth)/forgot-password/page.tsx:50-61`
- Password reset: Redirect to login with success parameter → `src/app/(auth)/reset-password/page.tsx:62`

### Loading States

- "Slanje..." during request submission → `src/app/(auth)/forgot-password/page.tsx:88`
- "Resetiranje..." during password update → `src/app/(auth)/reset-password/page.tsx:136`

### Navigation

- Link back to login from both pages
- Link to registration from forgot password page
- Link to request new reset from invalid token page

## Verification Checklist

- [x] User can request password reset from login page
- [x] User receives email with reset link (when email exists)
- [x] Reset link contains valid token in query parameter
- [x] Token expires after 1 hour
- [x] User can set new password meeting requirements
- [x] Old password no longer works after reset
- [x] Token can only be used once
- [x] Rate limiting prevents abuse
- [x] System doesn't reveal if email exists
- [x] Error messages are user-friendly and secure

## Evidence Links

1. `src/app/(auth)/forgot-password/page.tsx:1-110` - Forgot password form UI
2. `src/app/(auth)/reset-password/page.tsx:1-151` - Reset password form UI
3. `src/app/actions/auth.ts:105-211` - Password reset server actions
4. `src/lib/email/templates/password-reset-email.tsx:1-175` - Email template
5. `src/lib/email.ts:25-64` - Email sending service
6. `src/lib/security/rate-limit.ts:19-23` - Rate limit configuration
7. `src/lib/security/rate-limit.ts:34-95` - Rate limit implementation
8. `prisma/schema.prisma:59-66` - PasswordResetToken database model
9. `src/app/(auth)/login/page.tsx:200-202` - Login page forgot password link
10. `docs/_meta/inventory/routes.json:252-255` - Forgot password route
11. `docs/_meta/inventory/routes.json:378-381` - Reset password route
