# DevEx / CI / Infrastructure Audit

## Overview
Assessed developer workflows, environment management, Docker setup, and CI readiness.

## Findings
1. **No continuous integration** – Repository lacks any `.github/workflows` (or other CI config), so linting, type checks, Prisma migrations, and tests are never enforced before deployment. Introduce a pipeline (GitHub Actions or equivalent) that runs `npm run lint`, `npm run build`, and database migrations on every PR/main push.
2. **Missing `.env.example` / secrets guidance** – The repo includes `.env` and `.env.local` with real connection strings but no sanitized template for contributors. Provide a checked-in `.env.example` with placeholder values plus documentation on how to configure Coolify/production secrets, and keep sensitive files out of git.
3. **Dockerfile not optimized for target platform** – Production runs on ARM64 (per docs) yet `Dockerfile` starts from `FROM node:20-alpine` without `--platform=linux/arm64`. Builds performed on x86 may emit incompatible binaries. Pin the platform in each stage or use `node:20-alpine@sha256:...` multi-arch images, and document the expectation.
4. **Compose file doubles as production manifest** – `docker-compose.yml:1-40` mixes local dev and prod concerns (hard-coded secrets, `NEXTAUTH_URL=https://erp.metrica.hr`). Maintain separate `docker-compose.dev.yml` and `docker-compose.prod.yml` (or .env overrides) so developers can run the stack safely without touching prod credentials.
5. **No task automation for Prisma** – There is no script for `prisma migrate deploy`/`prisma db push` in `package.json`. Add npm scripts (e.g., `"db:migrate"`) and document migration flow to keep schema changes synchronized.
6. **Observability missing** – There are no logging/monitoring hooks (no structured logger, no health metrics, no uptime checks). Instrument the app via middleware or integrate Coolify monitoring, and ensure logs are structured for ingestion.

## Recommendations
- Add CI workflow(s) enforcing lint/build/test + Prisma migration validation on every change.
- Provide `.env.example` and secret-management docs; remove live credentials from tracked files.
- Align Docker images with target architecture and split dev/prod compose configs.
- Add npm scripts + docs for running Prisma migrations locally/in CI.
- Plan for observability (structured logs, health endpoints, monitoring dashboards) before scaling tenants.
