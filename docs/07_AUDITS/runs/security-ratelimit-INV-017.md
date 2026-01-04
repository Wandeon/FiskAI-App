# INV-017 Rate Limiting Audit

## Endpoint list (AI, extraction, AI-triggering jobs)

- **POST /api/ai/extract** – OCR receipt or text extraction via OpenAI; uses `checkRateLimit` before calling AI.
- **POST /api/ai/suggest-category** – Category suggestions (keyword/DB heuristics) with no rate limiter.
- **POST /api/ai/feedback**, **GET /api/ai/feedback** – AI feedback submission/read without rate limiting.
- **GET /api/ai/usage** – Usage/limit introspection (read-only, no limiter).
- **POST /api/banking/import/process** – Triggers bank import job that calls Deepseek and OpenAI vision helpers for PDF repair; no rate limiting or AI usage gating.

## Rate limiting mechanism

- AI limiter implemented in `checkRateLimit`:
  - Short-term in-memory window: 10 requests per company per minute with `retryAfter` seconds on block.
  - Monthly quotas pulled from company `subscriptionPlan`; enforces total-call, total-cost, and optional per-operation caps; returns structured `usage` payload on deny.
  - On errors in limiter, request is allowed but error is logged.
- Enforcement coverage:
  - **Applied** only on `/api/ai/extract` before calling OCR/text extraction.
  - **Not applied** on AI-adjacent endpoints (`/api/ai/suggest-category`, `/api/ai/feedback`, `/api/ai/usage`) or the bank import job trigger despite downstream AI usage.

## Subscription tier mapping

- Plan limits defined for `pausalni`, `obrtnicki`, `obrt_vat`, `doo_small`, `doo_standard`, `enterprise`, plus `default` fallback.
- Billing/Stripe plans use ids `pausalni`, `standard`, `pro`; only `pausalni` matches limiter keys. `standard` and `pro` are not in `PLAN_LIMITS`, so limiter falls back to `default` trial limits. Tier alignment for those plans is **UNKNOWN/incorrectly mapped** without additional configuration evidence.

## Error/response behavior

- `/api/ai/extract` returns HTTP 429 with error message, `retryAfter`, and `usage` details when limited; logs a warning with company, operation, and reason.
- Limiter’s short-term block also logs and surfaces a user-facing wait message.
- Other AI/extraction paths lack rate limit enforcement, so 429/responses are undefined there.

## Findings and recommended fixes

- **AI extraction endpoint enforcement present but tier mapping incomplete.** Billing plans `standard`/`pro` are not recognized by the limiter and receive `default` quotas; add matching entries or normalize `subscriptionPlan` values before lookup.
- **AI-capable endpoints without rate limiting.** Add `checkRateLimit` (or equivalent) to `POST /api/ai/suggest-category`, `POST /api/ai/feedback`, and `GET /api/ai/feedback` if AI cost/abuse risk applies, or document why exempt.
- **Background bank import AI calls ungated.** `POST /api/banking/import/process` triggers Deepseek/OpenAI work without rate limits or per-tier controls; add limiter/usage tracking per company to the processor or route.

## Evidence

- `/api/ai/extract` rate limit check, 429 response, and logging: `src/app/api/ai/extract/route.ts` lines 1-83.【F:src/app/api/ai/extract/route.ts†L1-L83】
- Limiter configuration (per-minute window, plan map, usage checks, retry handling): `src/lib/ai/rate-limiter.ts` lines 1-255.【F:src/lib/ai/rate-limiter.ts†L1-L255】
- Usage introspection using limiter data (no enforcement): `src/app/api/ai/usage/route.ts` lines 1-45.【F:src/app/api/ai/usage/route.ts†L1-L45】
- AI endpoints without limiter hooks: `src/app/api/ai/suggest-category/route.ts` lines 1-66 and `src/app/api/ai/feedback/route.ts` lines 1-128.【F:src/app/api/ai/suggest-category/route.ts†L1-L66】【F:src/app/api/ai/feedback/route.ts†L1-L128】
- AI-driven bank import job trigger and processor AI calls without rate limiting: `src/app/api/banking/import/process/route.ts` lines 1-45 and `src/lib/banking/import/processor.ts` lines 340-520.【F:src/app/api/banking/import/process/route.ts†L1-L45】【F:src/lib/banking/import/processor.ts†L340-L520】
- Billing plan ids used for subscriptions (`pausalni`, `standard`, `pro`) not aligned to limiter’s plan map: `src/lib/billing/stripe.ts` lines 1-138.【F:src/lib/billing/stripe.ts†L1-L138】

## Tests

- No automated tests found for INV-017 rate limiting. Suggested cases:
  - Assert `/api/ai/extract` returns 429 with `retryAfter` and `usage` after exceeding per-minute and monthly limits for a seeded company.
  - Verify limiter chooses correct plan limits for `subscriptionPlan` values including a `standard` company (currently defaulted) once mapping is fixed.
  - Exercise `/api/banking/import/process` and ensure AI calls are blocked or logged when rate limits exceeded once enforcement is added.
