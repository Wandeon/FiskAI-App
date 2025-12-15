# Feature: Billing Settings

## Status

- Documentation: Complete
- Last verified: 2025-12-15
- Evidence count: 14

## Purpose

Allows users to view and manage their subscription plan, track usage limits (invoices and users per month), upgrade or downgrade plans, and access the Stripe customer portal for payment method management. The feature integrates with Stripe for subscription billing, provides real-time usage tracking, handles trial periods, and enforces plan limits across invoice creation workflows. Companies can choose between three plans (Paušalni obrt, D.O.O. Standard, D.O.O. Pro) with different invoice and user limits.

## User Entry Points

| Type | Path                       | Evidence                                          |
| ---- | -------------------------- | ------------------------------------------------- |
| Page | /settings/billing          | `src/app/(dashboard)/settings/billing/page.tsx:1` |
| API  | POST /api/billing/checkout | `src/app/api/billing/checkout/route.ts:10-47`     |
| API  | POST /api/billing/portal   | `src/app/api/billing/portal/route.ts:10-41`       |
| API  | POST /api/billing/webhook  | `src/app/api/billing/webhook/route.ts:8-28`       |

## Core Flow

### View Billing Settings

1. User navigates to settings -> `src/app/(dashboard)/settings/page.tsx:1`
2. User accesses billing section via /settings/billing -> `src/app/(dashboard)/settings/billing/page.tsx:16-53`
3. Server authenticates user and retrieves company -> `src/app/(dashboard)/settings/billing/page.tsx:17-22`
4. Server fetches usage statistics (invoices/users this month) -> `src/app/(dashboard)/settings/billing/page.tsx:23`
5. System loads plan definitions from PLANS constant -> `src/app/(dashboard)/settings/billing/page.tsx:25-32`
6. BillingPageClient renders with plan cards and usage bars -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:44-284`
7. If trialing, displays trial banner with days remaining -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:119-133`
8. Current usage panel shows invoices used/limit and users count -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:136-184`
9. Plan cards display pricing, features, and action buttons -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:189-262`

### Subscribe to Plan (Upgrade/Downgrade)

1. User clicks plan button (Odaberi/Nadogradi/Aktiviraj) -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:243-256`
2. Client calls handleSubscribe with planId -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:65-87`
3. Client POSTs to /api/billing/checkout with planId -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:68-72`
4. Server validates authentication and company ownership -> `src/app/api/billing/checkout/route.ts:12-17`
5. Server validates planId against PLANS -> `src/app/api/billing/checkout/route.ts:22-24`
6. Server calls createCheckoutSession -> `src/app/api/billing/checkout/route.ts:30-35`
7. System fetches company and creates Stripe customer if needed -> `src/lib/billing/stripe.ts:96-110`
8. Stripe checkout session created with subscription metadata -> `src/lib/billing/stripe.ts:112-134`
9. User redirected to Stripe Checkout page -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:81`
10. On success, Stripe redirects to /settings/billing?success=true -> `src/app/api/billing/checkout/route.ts:27`
11. Success toast displayed to user -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:57-59`

### Manage Subscription (Payment Methods, Invoices, Cancel)

1. User clicks "Upravljaj pretplatom" or "Otvori portal za naplatu" -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:236,274`
2. Client calls handleManageSubscription -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:89-109`
3. Client POSTs to /api/billing/portal -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:92-94`
4. Server validates authentication and company ownership -> `src/app/api/billing/portal/route.ts:12-17`
5. Server checks if company has stripeCustomerId -> `src/app/api/billing/portal/route.ts:19-24`
6. Server calls createPortalSession with return URL -> `src/app/api/billing/portal/route.ts:29`
7. Stripe creates customer portal session -> `src/lib/billing/stripe.ts:158-161`
8. User redirected to Stripe Customer Portal -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:103`
9. User updates payment method, downloads invoices, or cancels subscription
10. On return, user lands back on /settings/billing -> `src/app/api/billing/portal/route.ts:27`

### Webhook Processing (Subscription Status Sync)

1. Stripe sends webhook event to /api/billing/webhook -> `src/app/api/billing/webhook/route.ts:8-28`
2. Server extracts body and Stripe signature -> `src/app/api/billing/webhook/route.ts:10-11`
3. Server validates signature and constructs event -> `src/lib/billing/stripe.ts:180`
4. System routes event by type -> `src/lib/billing/stripe.ts:184-203`
5. For checkout.session.completed: Updates company with subscriptionId, status=active, plan -> `src/lib/billing/stripe.ts:206-229`
6. For customer.subscription.updated/deleted: Syncs subscription status and period dates -> `src/lib/billing/stripe.ts:231-273`
7. For invoice.payment_failed: Logs warning for failed payment -> `src/lib/billing/stripe.ts:275-289`
8. Database updated with new subscription state -> `src/lib/billing/stripe.ts:217-226,262-270`

## Key Modules

| Module            | Purpose                                     | Location                                                       |
| ----------------- | ------------------------------------------- | -------------------------------------------------------------- |
| Billing Page      | Server component that loads usage and plans | `src/app/(dashboard)/settings/billing/page.tsx`                |
| BillingPageClient | Client component with plan selection UI     | `src/app/(dashboard)/settings/billing/billing-page-client.tsx` |
| Stripe Library    | Core billing logic, Stripe integration      | `src/lib/billing/stripe.ts`                                    |
| Checkout API      | Creates Stripe checkout session             | `src/app/api/billing/checkout/route.ts`                        |
| Portal API        | Creates Stripe customer portal session      | `src/app/api/billing/portal/route.ts`                          |
| Webhook API       | Handles Stripe webhook events               | `src/app/api/billing/webhook/route.ts`                         |
| Invoice Actions   | Enforces limits on invoice creation         | `src/app/actions/invoice.ts:41,123`                            |
| E-Invoice Actions | Enforces limits on e-invoice creation       | `src/app/actions/e-invoice.ts:21`                              |

## Data

### Database Tables

- **Company**: Stores subscription and billing data -> `prisma/schema.prisma:68-131`
  - Stripe fields: stripeCustomerId, stripeSubscriptionId -> `prisma/schema.prisma:94-95`
  - Subscription fields: subscriptionStatus, subscriptionPlan -> `prisma/schema.prisma:96-97`
  - Period tracking: subscriptionCurrentPeriodStart, subscriptionCurrentPeriodEnd -> `prisma/schema.prisma:98-99`
  - Limits: invoiceLimit (default 50), userLimit (default 1) -> `prisma/schema.prisma:100-101`
  - Trial: trialEndsAt (nullable DateTime) -> `prisma/schema.prisma:102`
  - Unique constraints: stripeCustomerId, stripeSubscriptionId -> `prisma/schema.prisma:94-95`

### Plan Configuration

```typescript
export const PLANS = {
  pausalni: {
    name: "Paušalni obrt",
    priceEur: 39,
    invoiceLimit: 50,
    userLimit: 1,
    stripePriceId: process.env.STRIPE_PRICE_PAUSALNI,
  },
  standard: {
    name: "D.O.O. Standard",
    priceEur: 99,
    invoiceLimit: 200,
    userLimit: 5,
    stripePriceId: process.env.STRIPE_PRICE_STANDARD,
  },
  pro: {
    name: "D.O.O. Pro",
    priceEur: 199,
    invoiceLimit: -1, // unlimited
    userLimit: -1, // unlimited
    stripePriceId: process.env.STRIPE_PRICE_PRO,
  },
}
```

Source: `src/lib/billing/stripe.ts:26-48`

### Subscription Status Values

- **trialing**: Trial period active, limited features available -> `prisma/schema.prisma:96`
- **active**: Subscription active, full access to plan features
- **canceled**: Subscription canceled, falls back to limited tier
- **unpaid**: Payment failed, limited access -> `src/lib/billing/stripe.ts:256`

### Usage Tracking Structure

```typescript
interface Usage {
  plan: string // Current plan ID
  status: string // Subscription status
  trialEndsAt: Date | null // Trial end date
  invoices: {
    used: number // Invoices created this month
    limit: number // Plan invoice limit
    unlimited: boolean // True if limit === -1
  }
  users: {
    used: number // Active company users
    limit: number // Plan user limit
    unlimited: boolean // True if limit === -1
  }
}
```

Source: `src/lib/billing/stripe.ts:342-370`

## Business Rules

### Trial Period Handling

- New companies default to "trialing" status -> `prisma/schema.prisma:96`
- Trial gives limited access based on default limits (50 invoices, 1 user)
- Trial end date stored in trialEndsAt field -> `prisma/schema.prisma:102`
- Trial banner shows days remaining when active -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:119-133`
- Trial expiration checked before invoice creation -> `src/lib/billing/stripe.ts:305-310`

### Plan Limit Enforcement

- Invoice creation blocked when monthly limit reached -> `src/lib/billing/stripe.ts:294-337`
- Unlimited plans use limit value of -1 -> `src/lib/billing/stripe.ts:44-45`
- Usage counted from start of current month (day 1, 00:00:00) -> `src/lib/billing/stripe.ts:319-321`
- Error message shows current usage vs limit -> `src/app/actions/invoice.ts:46`
- Check performed before both regular and e-invoice creation -> `src/app/actions/invoice.ts:41`, `src/app/actions/e-invoice.ts:21`

### Subscription Status Requirements

- Subscription must be "active" or "trialing" to create invoices -> `src/lib/billing/stripe.ts:313-316`
- Canceled/unpaid subscriptions fall back to very limited tier (5 invoices) -> `src/lib/billing/stripe.ts:256-260`
- Status synced automatically via Stripe webhooks -> `src/lib/billing/stripe.ts:231-273`

### Customer Creation

- Stripe customer created automatically on first checkout -> `src/lib/billing/stripe.ts:104-110`
- Customer email uses company owner's email or company email -> `src/lib/billing/stripe.ts:105-108`
- Customer metadata includes companyId for reverse lookup -> `src/lib/billing/stripe.ts:65-67`

## Security Features

### Authentication & Authorization

- Requires authenticated user session -> `src/app/(dashboard)/settings/billing/page.tsx:17-20`
- Requires user to have company -> `src/app/(dashboard)/settings/billing/page.tsx:22`
- All API routes validate authentication -> `src/app/api/billing/checkout/route.ts:12-15`
- Company ownership enforced via requireCompany -> `src/app/api/billing/checkout/route.ts:17`

### Webhook Security

- Stripe signature validation required -> `src/lib/billing/stripe.ts:180`
- STRIPE_WEBHOOK_SECRET must be configured -> `src/lib/billing/stripe.ts:174-178`
- Invalid signature returns 400 error -> `src/app/api/billing/webhook/route.ts:13-16`
- All webhook events logged for audit trail -> `src/lib/billing/stripe.ts:182`

### Payment Security

- No credit card data stored in application database
- All payment processing handled by Stripe Checkout
- Customer portal provides secure payment method updates
- Stripe API keys stored in environment variables only -> `src/lib/billing/stripe.ts:13-15`

### Data Integrity

- Subscription metadata includes companyId for validation -> `src/lib/billing/stripe.ts:125-132`
- Subscription ID stored as unique field prevents duplicates -> `prisma/schema.prisma:95`
- Invoice limit checks prevent over-usage -> `src/lib/billing/stripe.ts:294-337`
- Failed payments logged with company and invoice details -> `src/lib/billing/stripe.ts:288`

## Dependencies

- **Depends on**:
  - Authentication System - User sessions and company context
  - Company Management (F062) - Company data and ownership
  - Stripe API - Payment processing and subscription management
  - Environment Configuration - Stripe keys and price IDs

- **Depended by**:
  - Invoice Creation (F004) - Enforces invoice limits before creation
  - E-Invoice Creation (F005) - Enforces invoice limits before creation
  - User Management - Enforces user limits per plan
  - Feature Access Control - Gates features based on plan

## Integrations

### Stripe Integration

- Stripe SDK v2025-11-17.clover -> `src/lib/billing/stripe.ts:18`
- Lazy initialization prevents missing keys in dev -> `src/lib/billing/stripe.ts:11-23`
- Customer creation with metadata -> `src/lib/billing/stripe.ts:62-68`
- Checkout session with subscription mode -> `src/lib/billing/stripe.ts:112-134`
- Customer portal session for self-service -> `src/lib/billing/stripe.ts:158-161`
- Webhook event verification and routing -> `src/lib/billing/stripe.ts:169-204`

### Database Integration

- Prisma ORM for company subscription updates -> `src/lib/billing/stripe.ts:70-73,217-226`
- Usage counting via aggregations (count queries) -> `src/lib/billing/stripe.ts:323-328,349-353`
- Date-range filtering for monthly usage -> `src/lib/billing/stripe.ts:343-345`
- Subscription status synchronization -> `src/lib/billing/stripe.ts:262-270`

### Next.js Cache Integration

- Server-side rendering of usage stats -> `src/app/(dashboard)/settings/billing/page.tsx:23`
- Client-side state for loading indicators -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:52-53`
- URL search params for success/cancel messages -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:54-63`

### Logging Integration

- Logger tracks all billing events -> `src/lib/billing/stripe.ts:75,136,182`
- Checkout session creation logged -> `src/app/api/billing/checkout/route.ts:37`
- Portal session creation logged -> `src/app/api/billing/portal/route.ts:31`
- Failed payments logged with warnings -> `src/lib/billing/stripe.ts:288`

## UI Components

### Billing Page Components

- **BillingPageClient**: Main client component with state management -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:44-284`
- **Trial Banner**: Amber alert showing days remaining -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:119-133`
- **Usage Panel**: Progress bars for invoices and users -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:136-184`
- **Plan Cards**: Grid of subscription plans with pricing -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:189-262`
- **Manage Section**: Portal access for active subscriptions -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:266-281`

### Plan Card Features

- Current plan indicator badge -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:203-207`
- Pricing display (EUR/month) -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:209-212`
- Feature checklist with icons -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:213-230`
- Dynamic button labels (Odaberi/Nadogradi/Aktiviraj/Upravljaj) -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:232-258`
- Loading states during checkout -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:246-250`

### Usage Indicators

- Progress bars showing used vs limit -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:151-158,173-180`
- "Neograničeno" text for unlimited plans -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:144,165`
- Percentage-based width calculation -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:155`
- Brand color (#3a8dff) for progress fills -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:153,175`

### Localization (Croatian)

- All UI text in Croatian language
- "Naplata" (Billing) as page title -> `src/app/(dashboard)/settings/billing/page.tsx:12`
- "Upravljajte pretplatom i pratite potrošnju" as description -> `src/app/(dashboard)/settings/billing/page.tsx:39`
- Day pluralization (dan/dana) -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:125`
- Toast messages in Croatian -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:58,61,83`

## Error Handling

### API Errors

- **401 Unauthorized**: No valid session -> `src/app/api/billing/checkout/route.ts:14`
- **400 Invalid Plan**: PlanId not in PLANS -> `src/app/api/billing/checkout/route.ts:23`
- **400 No Customer**: Portal accessed without Stripe customer -> `src/app/api/billing/portal/route.ts:20-24`
- **500 Server Error**: Stripe API failures -> `src/app/api/billing/checkout/route.ts:42-45`

### Webhook Errors

- **Missing Signature**: Returns 400 error -> `src/app/api/billing/webhook/route.ts:13-16`
- **Invalid Signature**: Stripe throws error, caught and logged -> `src/app/api/billing/webhook/route.ts:21-27`
- **Missing Metadata**: Logged as error, early return -> `src/lib/billing/stripe.ts:210-213`
- **Company Not Found**: Logged as error, subscription orphaned -> `src/lib/billing/stripe.ts:239-242`

### Client-Side Errors

- **Checkout Failed**: Toast error message displayed -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:82-84`
- **Portal Failed**: Toast error message displayed -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:104-106`
- **Network Errors**: Caught and displayed as generic error -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:83,105`
- **Cancel Flow**: Shows "Naplata otkazana" toast -> `src/app/(dashboard)/settings/billing/billing-page-client.tsx:60-62`

### Limit Errors

- **Invoice Limit Reached**: Blocked with usage message -> `src/app/actions/invoice.ts:42-48`
- **Trial Expired**: Blocked with warning log -> `src/lib/billing/stripe.ts:306-309`
- **Subscription Inactive**: Blocked with status warning -> `src/lib/billing/stripe.ts:313-316`
- **Payment Failed**: Logged for future notification (TODO) -> `src/lib/billing/stripe.ts:287-288`

## Verification Checklist

- [x] User can access billing page at /settings/billing
- [x] Current plan displayed with "Trenutni plan" badge
- [x] Trial banner shows days remaining for trialing status
- [x] Usage panel shows invoice and user counts with progress bars
- [x] All three plans displayed with pricing and features
- [x] Subscribe button creates Stripe checkout session
- [x] Stripe checkout redirects to payment page
- [x] Successful checkout activates subscription
- [x] Success message displayed after checkout completion
- [x] Manage subscription button opens Stripe customer portal
- [x] Portal allows payment method updates
- [x] Webhooks sync subscription status to database
- [x] Invoice creation enforces plan limits
- [x] Unlimited plans show "Neograničeno" instead of counts
- [x] Loading states displayed during async operations
- [x] Error messages shown for failed operations
- [x] All text localized in Croatian

## Related Features

- **Company Settings** (F062): Company data used for billing -> `src/app/(dashboard)/settings/page.tsx`
- **Invoice Creation** (F004): Enforces billing limits -> `src/app/actions/invoice.ts:41`
- **E-Invoice Creation** (F005): Enforces billing limits -> `src/app/actions/e-invoice.ts:21`
- **User Management**: User count tracked for plan limits -> `src/lib/billing/stripe.ts:352`

## Evidence Links

1. `src/app/(dashboard)/settings/billing/page.tsx:1-53` - Billing page server component with usage stats loading
2. `src/app/(dashboard)/settings/billing/billing-page-client.tsx:1-284` - Client component with plan selection and portal access
3. `src/lib/billing/stripe.ts:1-361` - Core Stripe integration with plans, checkout, portal, webhooks
4. `src/lib/billing/stripe.ts:26-48` - Plan configuration (pausalni, standard, pro)
5. `src/lib/billing/stripe.ts:83-139` - Checkout session creation with subscription metadata
6. `src/lib/billing/stripe.ts:144-164` - Customer portal session creation
7. `src/lib/billing/stripe.ts:169-204` - Webhook event handling and routing
8. `src/lib/billing/stripe.ts:294-337` - Invoice limit enforcement (canCreateInvoice)
9. `src/lib/billing/stripe.ts:342-370` - Usage statistics calculation (getUsageStats)
10. `src/app/api/billing/checkout/route.ts:1-45` - Checkout API endpoint
11. `src/app/api/billing/portal/route.ts:1-41` - Portal API endpoint
12. `src/app/api/billing/webhook/route.ts:1-28` - Webhook API endpoint
13. `src/app/actions/invoice.ts:41-48` - Invoice creation limit check
14. `prisma/schema.prisma:94-102` - Company billing/subscription fields
