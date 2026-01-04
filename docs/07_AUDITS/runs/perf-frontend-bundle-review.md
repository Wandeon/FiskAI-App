# Frontend bundle audit

## Build and analysis configuration

- `next.config.ts` configures Sentry and security headers but does **not** enable any bundle analyzer or granular build output reporting; no `next/bundle-analyzer` or similar hooks are present.【F:next.config.ts†L1-L110】
- `package.json` scripts only cover `dev`, `build`, `start`, linting, and tests—there is no `analyze` or bundle-size inspection command registered to run in CI or locally.【F:package.json†L5-L21】

## Heavy dependencies observed

- Frontend bundle risk: `posthog-js` is statically imported in the analytics helper that sits behind the client-only `AnalyticsProvider`, so PostHog loads for every route when enabled.【F:src/lib/analytics.ts†L1-L32】【F:src/components/providers/analytics-provider.tsx†L1-L24】【F:src/app/layout.tsx†L1-L41】
- Server-weight modules present in dependencies: `@aws-sdk/client-s3`, `googleapis`, `@azure/msal-node`, `@microsoft/microsoft-graph-client`, `openai`, `stripe`, `@react-pdf/renderer`, and `react-pdf`. They are large and should stay on the server path; `googleapis` is currently imported eagerly inside the Gmail sync provider.【F:package.json†L32-L103】【F:src/lib/email-sync/providers/gmail.ts†L3-L120】
- UI extras: `react-dropzone` is pulled into multiple client components (import widgets, fiscalization dialog, compact dropzone) which can add several KB of vendor code to initial dashboard bundles.【F:src/components/import/smart-dropzone.tsx†L1-L67】
- Duplicate PDF stacks (`@react-pdf/renderer` and `react-pdf`) are both installed, increasing install size and risk of dual bundling if a client render path appears.【F:package.json†L32-L103】

## Dynamic import opportunities (no code changes made)

- **Analytics bootstrap:** Wrap PostHog in a dynamic import or lazy loader so anonymous users do not download analytics code until consent or a key is present. Currently it is statically imported in `src/lib/analytics.ts` and initialized from `AnalyticsProvider` in the global layout.【F:src/lib/analytics.ts†L1-L32】【F:src/components/providers/analytics-provider.tsx†L1-L24】【F:src/app/layout.tsx†L1-L41】
- **File upload widgets:** Convert the `react-dropzone`-based components (smart and compact dropzones, fiscalization upload dialog) to dynamic imports on pages where uploads are needed; keep lightweight placeholders elsewhere to trim the main dashboard bundle.【F:src/components/import/smart-dropzone.tsx†L1-L67】
- **Third-party SDKs:** Move `googleapis` (and other email/billing SDKs) behind on-demand imports in server routes/services to keep server bundles smaller and avoid accidental client-side inclusion.【F:src/lib/email-sync/providers/gmail.ts†L3-L120】

## Action plan

1. Add a bundle analyzer (e.g., `@next/bundle-analyzer`) and wire an `npm run analyze` script plus CI artifact upload so we can track client/server chunk weights per route.【F:next.config.ts†L1-L110】【F:package.json†L5-L21】
2. Implement lazy loading for analytics (defer `posthog-js` until consent or user login) to remove it from the baseline hydration payload.【F:src/lib/analytics.ts†L1-L32】【F:src/app/layout.tsx†L1-L41】
3. Dynamically import upload widgets or split them by route so `react-dropzone` only loads when a user opens file-upload workflows.【F:src/components/import/smart-dropzone.tsx†L1-L67】
4. Audit server-only SDK usage and convert heavy imports (`googleapis`, `stripe`, `@aws-sdk/client-s3`) to `await import()` inside handlers to prevent bundling in edge/client contexts and speed cold starts.【F:package.json†L32-L103】【F:src/lib/email-sync/providers/gmail.ts†L3-L120】
5. Review PDF stack usage and remove one of `@react-pdf/renderer` vs `react-pdf` (or isolate to server-only packages) to reduce dependency weight and avoid duplicate bundles.【F:package.json†L32-L103】
