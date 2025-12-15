# Code Quality & Architecture Audit

## Overview
Reviewed server actions, React components, and shared utilities in `src/app` and `src/lib` to evaluate structure, correctness, and maintainability.

## Findings
1. **Client pages import server actions directly** – `src/app/(dashboard)/e-invoices/new/page.tsx:12-55` imports `getContacts` from the `"use server"` action module and calls it inside `useEffect`. This bypasses server-component data fetching patterns, couples the client bundle to server-only code, and makes error/loading states hard to manage. Replace with server-side data fetching (load contacts in the page’s async component and pass via props) or expose a typed API route/React Query hook.
2. **Money totals computed with floating-point math before persisting** – `src/app/actions/e-invoice.ts:24-49` multiplies JS numbers to derive `netAmount`, `vatAmount`, and `totalAmount`, then wraps them with `new Decimal(...)`. Floating-point accumulation can yield rounding errors for currency (e.g., 0.1+0.2). Use Prisma `Decimal` (or a helper) for all arithmetic to ensure exact cents throughout.
3. **Redundant auth/company lookups** – In `src/app/(dashboard)/e-invoices/page.tsx:7-20` the page already runs `requireAuth`/`requireCompany`, but it then calls `getEInvoices()` (`src/app/actions/e-invoice.ts:145-165`), which repeats the same checks, resulting in duplicate DB queries per request. Either accept a `companyId` parameter or move the query logic directly into the page component to avoid N+1 lookups and simplify tracing.
4. **Server actions return unstructured errors** – Actions such as `register`, `login`, `createCompany`, and `createEInvoice` (`src/app/actions/*.ts`) return `{ error: string }` without error codes or field metadata (except one schema flatten). This makes client UX inconsistent and hampers logging/observability. Introduce a shared result type (`{ ok: boolean; message; code; details }`) and centralize logging so both UI and telemetry stay consistent.
5. **No shared validation/masking utilities for repeated business fields** – OIB, IBAN, phone, and VAT logic are replicated in multiple forms (`src/app/(dashboard)/onboarding/page.tsx`, `src/app/(dashboard)/e-invoices/new/page.tsx`). Extract reusable input components with built-in formatting, validation hooks, and help text to reduce duplication and future bugs.

## Recommendations
- Consolidate data fetching in server components (or use React Query/Route Handlers) instead of importing server actions into client code.
- Wrap monetary math in helper utilities that operate on `Decimal` objects end-to-end.
- Pass `companyId`/`userId` into helper queries so they can skip repeated auth hits.
- Define a typed `ActionResult` helper plus logging middleware for server actions to standardize error/success handling.
- Build reusable form controls for domain-specific fields (OIB, IBAN, VAT rate) to keep logic centralized and easier to test.
