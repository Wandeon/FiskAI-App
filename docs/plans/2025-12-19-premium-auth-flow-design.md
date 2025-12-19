# Premium Auth Flow Design

## Overview

Replace separate `/login` and `/register` pages with a unified `/auth` experience featuring cinematic animations, microinteractions, and a reactive gradient aurora background.

## Goals

- Create a "mini product demo" feel for authentication
- Establish FiskAI as a premium, modern product from first interaction
- Switch from email verification links to OTP codes for better UX

## Flow Architecture

### Single `/auth` route with 5 states:

```
IDENTIFY → AUTHENTICATE → REGISTER (if new) → VERIFY → SUCCESS
```

### State Machine

| State        | Purpose                              | Next States                               |
| ------------ | ------------------------------------ | ----------------------------------------- |
| IDENTIFY     | Email input + Google option          | AUTHENTICATE (existing) or REGISTER (new) |
| AUTHENTICATE | Password/passkey for returning users | VERIFY (on success)                       |
| REGISTER     | Name + password for new users        | VERIFY (on submit)                        |
| VERIFY       | 6-digit OTP input                    | SUCCESS (on valid code)                   |
| SUCCESS      | Celebration + redirect               | Dashboard (auto-redirect)                 |

### Flow Details

1. **IDENTIFY** - Email input with small "Continue with Google" below
   - On submit: check if email exists via `/api/auth/check-email`
   - Existing user → AUTHENTICATE
   - New user → REGISTER

2. **AUTHENTICATE** - "Welcome back" with email as clickable label
   - Password field + "Use passkey instead" (if registered)
   - Forgot password link
   - On success → VERIFY (send OTP) or direct login (if email already verified)

3. **REGISTER** - "Create your account" with email locked as label
   - Name + password + confirm password
   - Terms checkbox
   - On submit → create user + send OTP → VERIFY

4. **VERIFY** - 6-digit OTP input
   - "Code sent to {email}" message
   - Resend link with cooldown timer
   - Auto-submits when 6 digits entered
   - On valid → SUCCESS

5. **SUCCESS** - Checkmark animation + aurora goes golden
   - Auto-redirect to dashboard based on systemRole (2s delay)

## Animated Card Component

### Container

- Centered card, `max-w-md`
- Glassmorphism: `bg-white/80 backdrop-blur-xl`
- Framer Motion `layout` prop for smooth height changes
- `rounded-2xl` corners, elevated shadow

### Step Transitions

```typescript
// Exit animation
{ opacity: 0, y: -10, filter: "blur(6px)" }

// Enter animation
{ opacity: 0, y: 10, filter: "blur(6px)" } → { opacity: 1, y: 0, filter: "blur(0px)" }

// Duration: 250ms each
// AnimatePresence mode="wait"
```

### Shared Element Transitions

- Email input uses `layoutId="email-display"`
- Morphs into styled label in subsequent steps
- Label is clickable → returns to IDENTIFY

### Spring Physics

```typescript
transition: { type: "spring", stiffness: 260, damping: 24 }
```

## Input Microinteractions

### Text Inputs

| State     | Effect                                               |
| --------- | ---------------------------------------------------- |
| Focus     | Border → cyan + `ring-2 ring-cyan-500/20` glow       |
| Valid     | Green checkmark fades in on right                    |
| Invalid   | Horizontal shake (3x, 4px, 300ms) + red border flash |
| Error msg | Slides down with fade, no layout jump                |

### Primary Button States

| State   | Effect                                            |
| ------- | ------------------------------------------------- |
| Idle    | Solid brand color                                 |
| Hover   | Scale 1.02 + deeper shadow                        |
| Pressed | Scale 0.98                                        |
| Loading | Text fades → spinner fades in                     |
| Success | Spinner → checkmark SVG draws in → green bg flash |

### OTP Input (6 boxes)

- Auto-focus first box on mount
- Type digit → auto-advance
- Backspace on empty → previous box
- Paste 6 digits → fill all + auto-submit
- Active box: scale 1.05 + cyan ring
- Error: all boxes shake + red flash

## Gradient Aurora Background

### Implementation

- Full-screen fixed background behind card
- Built with Rive for organic movement
- CSS fallback for reduced-motion preference

### Color States

| State        | Colors                         | Movement           |
| ------------ | ------------------------------ | ------------------ |
| IDENTIFY     | Calm cyan/teal + subtle purple | Slow drift         |
| AUTHENTICATE | Vibrant cyan                   | Medium movement    |
| REGISTER     | Cyan + warm amber hint         | Welcoming pulse    |
| VERIFY       | Focused blue/cyan              | Concentrated       |
| SUCCESS      | Golden/amber bloom             | Expansive          |
| Error        | Brief red tint                 | Quick pulse → calm |

### Technical Details

- Rive state machine inputs: `state` (string), `error` (trigger)
- Opacity: 30-50% (subtle, doesn't compete with form)
- State transitions: 800-1000ms
- GPU compositing with `will-change: transform`

## Backend: OTP Verification

### New Database Table

```typescript
// lib/db/schema/verification-codes.ts
export const verificationCodes = pgTable("verification_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  email: varchar("email", { length: 255 }).notNull(),
  codeHash: varchar("code_hash", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // EMAIL_VERIFY, PASSWORD_RESET
  expiresAt: timestamp("expires_at").notNull(),
  attempts: integer("attempts").default(0),
  createdAt: timestamp("created_at").defaultNow(),
})
```

### API Endpoints

| Endpoint                | Method | Purpose                       |
| ----------------------- | ------ | ----------------------------- |
| `/api/auth/check-email` | POST   | Check if email exists         |
| `/api/auth/register`    | POST   | Create user + send OTP        |
| `/api/auth/send-code`   | POST   | Send/resend OTP               |
| `/api/auth/verify-code` | POST   | Validate OTP + create session |

### Security

- Codes hashed with bcrypt
- Rate limit: 3 codes per email per hour
- Max 5 attempts per code
- Codes expire in 10 minutes
- Lockout: 10 failed attempts → 30 min cooldown

### Email Template

- Clean, branded design
- Large 6-digit code with letter-spacing
- "This code expires in 10 minutes"
- No-reply sender address

## File Structure

### New Files

```
src/
├── app/(marketing)/auth/
│   └── page.tsx                    # Main auth flow page
├── components/auth/
│   ├── AuthFlow.tsx                # State machine + orchestration
│   ├── steps/
│   │   ├── IdentifyStep.tsx        # Email input
│   │   ├── AuthenticateStep.tsx    # Password + passkey
│   │   ├── RegisterStep.tsx        # Registration form
│   │   ├── VerifyStep.tsx          # OTP input
│   │   └── SuccessStep.tsx         # Celebration
│   ├── OTPInput.tsx                # Premium 6-digit input
│   ├── AnimatedButton.tsx          # Loading/success states
│   └── AuroraBackground.tsx        # Rive gradient
├── lib/db/schema/
│   └── verification-codes.ts       # Drizzle schema
└── app/api/auth/
    ├── check-email/route.ts
    ├── send-code/route.ts
    └── verify-code/route.ts
```

### Files to Modify

- Delete `src/app/(marketing)/login/page.tsx` (redirect to `/auth`)
- Delete `src/app/(marketing)/register/page.tsx` (redirect to `/auth`)
- Update `middleware.ts` for `/auth` route handling
- Update Resend email templates for OTP format

### Dependencies to Add

```bash
npm install @rive-app/react-canvas
```

## Reduced Motion Support

When `prefers-reduced-motion` is enabled:

- Disable aurora animation (static gradient)
- Replace slide/blur transitions with simple fades
- Keep button state changes but remove scale effects
- OTP boxes don't scale on focus

## Success Criteria

1. Auth flow feels like a "product demo" not a form
2. Transitions are smooth, never janky
3. Error states are clear but not aggressive
4. Works perfectly on mobile
5. Accessible (keyboard nav, screen readers, reduced motion)
6. Page load to first input: < 1 second
