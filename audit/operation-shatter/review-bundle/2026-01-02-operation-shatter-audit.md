# Operation Shatter Hardening + Audit Report Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Produce audit-grade, reproducible evidence for Operation Shatter, including H2 sample UPDATE before/after and a Phase 3 report referencing immutable evidence files.

**Architecture:** Use the existing `scripts/operation-shatter.ts` runner and stored evidence bundle under `audit/operation-shatter/evidence/`. Add a tiny Prisma-based script to extract a concrete UPDATE audit event with `before/after` for a known `correlationId`, then generate a strict-format report that references evidence files and DB IDs.

**Tech Stack:** Node.js (TS), Prisma, Vitest, Postgres.

### Task 1: Add H2 sample audit-event dumper

**Files:**

- Create: `scripts/dump-audit-sample-update.ts`
- Create: `audit/operation-shatter/evidence/h2-sample-update.json` (generated output)

**Step 1: Implement script**

- Query `AuditLog` for a recent UPDATE event with `correlationId` in `SHATTER-S1..S4` and a non-null `before` payload.
- Print a single deterministic JSON blob to stdout (and optionally write the evidence file).

**Step 2: Run it**

Run:

- `DATABASE_URL='postgresql://fiskai:fiskai_secret_2025@localhost:5434/fiskai_shatter?schema=public' npx tsx scripts/dump-audit-sample-update.ts --correlationId SHATTER-S3 --out audit/operation-shatter/evidence/h2-sample-update.json`

Expected:

- Exit code 0
- Output file contains `correlationId`, `entity`, `entityId`, `before`, `after`.

### Task 2: Verify gates and scenario runner are executable

**Files:**

- No code changes expected
- Evidence already present under `audit/operation-shatter/evidence/`

**Step 1: Run gates**

Run:

- `DATABASE_URL='postgresql://fiskai:fiskai_secret_2025@localhost:5434/fiskai_shatter?schema=public' npx vitest run`

Expected:

- PASS

**Step 2: Run runner**

Run:

- `DATABASE_URL='postgresql://fiskai:fiskai_secret_2025@localhost:5434/fiskai_shatter?schema=public' npx tsx scripts/operation-shatter.ts`

Expected:

- Prints structured step JSON
- Writes an evidence bundle JSON under `audit/operation-shatter/evidence/`

### Task 3: Write Phase 3 audit report (strict format)

**Files:**

- Create: `audit/operation-shatter/AUDIT_REPORT.md`

**Step 1: Generate report content**

- Use `audit/operation-shatter/PHASE0_INVENTORY.md` and `audit/operation-shatter/evidence/shatter-evidence.json`.
- Reference exact evidence files for: tests, grep output, runner output, H2 sample update JSON.
- Include commands used, DB entity IDs, audit log IDs per correlationId, artifact checksums + storage keys.

**Step 2: Sanity-check links**

- Ensure every claim points to a file path and (where relevant) a function/symbol name.
