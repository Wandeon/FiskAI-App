# Feature: User Registration

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 12

## Purpose

Allows new users to create an account in FiskAI by providing their name, email, and password. After successful registration, users receive a welcome email and are redirected to login to access the application.

## User Entry Points

| Type | Path      | Evidence                              |
| ---- | --------- | ------------------------------------- |
| Page | /register | `src/app/(auth)/register/page.tsx:14` |

## Core Flow

1. User navigates to /register route → `src/app/(auth)/register/page.tsx:14`
2. Form displays with name, email, password, and confirm password fields → `src/app/(auth)/register/page.tsx:47-101`
3. Client-side validation using Zod schema → `src/lib/validations/auth.ts:8-20`
4. Form submission triggers register server action → `src/app/actions/auth.ts:12`
5. Server validates input and checks if email already exists → `src/app/actions/auth.ts:21-27`
6. Password is hashed using bcrypt (10 rounds) → `src/app/actions/auth.ts:29`
7. User record created in database → `src/app/actions/auth.ts:31-37`
8. Welcome email sent to user (non-blocking) → `src/app/actions/auth.ts:40-56`
9. User redirected to /login with success indicator → `src/app/(auth)/register/page.tsx:37`

## Key Modules

| Module              | Purpose                                 | Location                                    |
| ------------------- | --------------------------------------- | ------------------------------------------- |
| RegisterPage        | Registration form UI component          | `src/app/(auth)/register/page.tsx`          |
| register (action)   | Server action handling registration     | `src/app/actions/auth.ts:12-59`             |
| registerSchema      | Validation schema for registration data | `src/lib/validations/auth.ts:8-20`          |
| WelcomeEmail        | Welcome email template                  | `src/lib/email/templates/welcome-email.tsx` |
| AuthLayout          | Layout wrapper for auth pages           | `src/app/(auth)/layout.tsx:3-9`             |
| CredentialsProvider | NextAuth provider for email/password    | `src/lib/auth.ts:18-82`                     |

## Data

- **Tables**: `User` → `prisma/schema.prisma:9`
- **Key fields**:
  - `id` (String, CUID) - Unique user identifier
  - `email` (String, unique) - User's email address
  - `name` (String, optional) - User's full name
  - `passwordHash` (String) - Bcrypt-hashed password
  - `createdAt` (DateTime) - Account creation timestamp
  - `updatedAt` (DateTime) - Last update timestamp

## Security Features

### Password Requirements

- **Minimum length**: 8 characters → `src/lib/validations/auth.ts:11-13`
- **Uppercase letter**: At least one required → `src/lib/validations/auth.ts:14`
- **Number**: At least one required → `src/lib/validations/auth.ts:15`
- **Confirmation**: Passwords must match → `src/lib/validations/auth.ts:17-19`

### Password Storage

- **Hashing algorithm**: bcrypt with 10 rounds → `src/app/actions/auth.ts:29`
- **Storage**: Stored as `passwordHash` in User table → `prisma/schema.prisma:15`

### Duplicate Prevention

- Email uniqueness enforced at database level → `prisma/schema.prisma:11`
- Server-side check prevents duplicate registration → `src/app/actions/auth.ts:21-27`

## Email Integration

### Welcome Email

- **Sent after**: Successful user creation → `src/app/actions/auth.ts:40-56`
- **Template**: WelcomeEmail component → `src/lib/email/templates/welcome-email.tsx:20-108`
- **Content includes**:
  - Personalized greeting with user's name
  - Feature overview (e-invoicing, fiscalization, receipt scanning, bank integration, reporting)
  - Onboarding steps (login, enter company data, create first invoice)
  - Trial period information (14 days)
  - Login button with direct link
  - Support contact information

### Email Failure Handling

- Email sending is non-blocking → `src/app/actions/auth.ts:53-56`
- Registration succeeds even if email fails → `src/app/actions/auth.ts:54-55`
- Errors logged but not shown to user → `src/app/actions/auth.ts:55`

## User Experience

### Form Validation

- **Client-side**: React Hook Form with Zod resolver → `src/app/(auth)/register/page.tsx:23-24`
- **Real-time feedback**: Field-level error messages → `src/app/(auth)/register/page.tsx:61-62`
- **Server-side**: Additional validation in action → `src/app/actions/auth.ts:13-17`

### Loading States

- Submit button disabled during registration → `src/app/(auth)/register/page.tsx:103`
- Button text changes to "Registracija..." → `src/app/(auth)/register/page.tsx:104`

### Error Handling

- Duplicate email: "Email already in use" → `src/app/actions/auth.ts:26`
- Invalid fields: "Invalid fields" → `src/app/actions/auth.ts:16`
- Error displayed in red banner above form → `src/app/(auth)/register/page.tsx:48-52`

### Success Flow

- Success message returned from action → `src/app/actions/auth.ts:58`
- User redirected to /login?registered=true → `src/app/(auth)/register/page.tsx:37`

## Dependencies

- **Depends on**: None (standalone feature)
- **Depended by**:
  - [[auth-login]] - Users must login after registration
  - [[onboarding]] - New users go through onboarding after first login

## Integrations

- **NextAuth**: Authentication framework → `src/lib/auth.ts:9-116`
- **React Hook Form**: Form state management → `src/app/(auth)/register/page.tsx:19-25`
- **Zod**: Schema validation → `src/lib/validations/auth.ts:1-24`
- **bcryptjs**: Password hashing → `src/app/actions/auth.ts:4`
- **Prisma**: Database ORM → `src/app/actions/auth.ts:5`
- **Resend/React Email**: Email sending (templates) → `src/app/actions/auth.ts:42-43`

## Related Routes

- `/login` - Where users are redirected after registration → `src/app/(auth)/register/page.tsx:37`
- `/dashboard` - Default landing page after login → `src/lib/auth.ts:97`

## Verification Checklist

- [x] User can access registration page at /register
- [x] User can enter name, email, password, and confirm password
- [x] Client-side validation prevents invalid submissions
- [x] Password requirements are enforced (8 chars, uppercase, number)
- [x] Duplicate email addresses are rejected
- [x] Password is securely hashed with bcrypt
- [x] User record is created in database
- [x] Welcome email is sent to user
- [x] User is redirected to login page on success
- [x] Error messages are displayed for failures
- [x] Form shows loading state during submission
- [x] Registration works even if email sending fails

## Evidence Links

1. `src/app/(auth)/register/page.tsx:14-117` - Registration page component with form UI
2. `src/app/actions/auth.ts:12-59` - Server action handling registration logic
3. `src/lib/validations/auth.ts:8-20` - Zod schema for registration validation
4. `src/lib/email/templates/welcome-email.tsx:20-108` - Welcome email template
5. `src/lib/auth.ts:9-116` - NextAuth configuration with credentials provider
6. `src/app/(auth)/layout.tsx:3-9` - Auth layout wrapper for registration page
7. `prisma/schema.prisma:9-23` - User model definition in database schema
8. `src/app/actions/auth.ts:29` - Password hashing implementation
9. `src/app/actions/auth.ts:31-37` - User creation in database
10. `src/app/actions/auth.ts:40-56` - Welcome email sending logic
11. `src/app/(auth)/register/page.tsx:47-101` - Form fields and validation display
12. `src/app/(auth)/register/page.tsx:37` - Redirect to login on success
