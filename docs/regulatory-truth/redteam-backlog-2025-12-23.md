# Regulatory Truth Layer E2E Audit Backlog (2025-12-23)

Artifacts: docs/regulatory-truth/audit-artifacts/2025-12-23/

## RT-2025-12-23-01 Evidence immutability fails for JSON/JSON-LD (INV-1)

Severity: P0
Component: Evidence store / Tier1 fetchers
Steps to reproduce:

1. Use evidence IDs from JSON sources in `evidence_hash_sample.json`.
2. Recompute hash via `hashRawContent(rawContent)` and compare to `contentHash`.
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-23/evidence_hash_sample.json (3/10 mismatches).
  Expected: sha256(rawContent) == contentHash for JSON/JSON-LD.
  Actual: EUR-Lex JSON evidence hashes mismatch.
  Root cause hypothesis: eurlex-fetcher hashes minified JSON (`hashContent(JSON.stringify(metadata))`) while storing pretty JSON (`JSON.stringify(metadata, null, 2)`).
  Fix suggestion: compute contentHash from the exact stored rawContent (or store canonicalized JSON + canonicalization metadata).
  Acceptance criteria: 10/10 hash matches on sampled JSON/JSON-LD evidence; CI regression test for EUR-Lex.

## RT-2025-12-23-02 Published rules without source pointers (INV-2)

Severity: P0
Component: Reviewer/Gates
Steps to reproduce:

1. Run query in `rules_without_pointers_approved_published.txt`.
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-23/rules_without_pointers_approved_published.txt (3 published rules with 0 pointers).
  Expected: every APPROVED/PUBLISHED rule has >=1 source pointer with URL + quote.
  Actual: published rules have 0 pointers.
  Root cause hypothesis: release gate does not enforce pointer presence or previous data left unvalidated.
  Fix suggestion: enforce pointer_count >=1 at approval and release; add DB constraint or gate check.
  Acceptance criteria: query returns 0 rows; releases reject any rule missing pointers.

## RT-2025-12-23-03 No-inference invariant fails (INV-3)

Severity: P0
Component: Extractor/Validator
Steps to reproduce:

1. Run `tmp/quote-value-check.ts` and inspect mismatches.
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-23/extraction_value_quote_check.json (5/10 mismatches).
  Expected: extracted value appears in quote after normalization.
  Actual: 50% mismatch on sampled pointers.
  Root cause hypothesis: normalization rules incomplete (dates/decimals), or extractor outputs values not grounded in quote.
  Fix suggestion: tighten validator normalization and block pointer creation when quote mismatch persists.
  Acceptance criteria: mismatch rate <=1% overall; 0% for APPROVED/PUBLISHED rules.

## RT-2025-12-23-04 Composer cannot persist rules (appliesWhen type mismatch)

Severity: P0
Component: Composer
Steps to reproduce:

1. Run composer batch: `npx tsx src/lib/regulatory-truth/scripts/run-composer.ts --batch`.
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-23/composer_run.log (0 success; Prisma error: appliesWhen expects string, got object).
  Expected: composer creates draft rules from ungrouped pointers.
  Actual: all rule creates fail due to appliesWhen type mismatch.
  Root cause hypothesis: schema expects string while composer passes object; DSL serialization mismatch.
  Fix suggestion: serialize appliesWhen to JSON string before write, or migrate schema to JSON.
  Acceptance criteria: composer batch creates rules; no appliesWhen type errors.

## RT-2025-12-23-05 Tier1 fetchers fail (HNB/NN/EUR-Lex unavailable)

Severity: P1
Component: Tier1 fetchers
Steps to reproduce:

1. Run tier1 fetchers: `npx tsx -e "import('./src/lib/regulatory-truth/fetchers').then(m=>m.default.runTier1Fetchers())"`.
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-23/tier1_fetchers.json (Prisma errors, 0 HNB/NN/EUR-Lex created).
  Expected: HNB exchange rates, NN metadata, and EUR-Lex evidence created.
  Actual: fetchers fail with Prisma invocation errors.
  Root cause hypothesis: Prisma client/schema mismatch in tier1 fetcher runtime.
  Fix suggestion: align Prisma client with DB schema used in runtime; add tier1 fetcher smoke test in CI.
  Acceptance criteria: tier1 fetchers run with success=true and create new evidence/rules.

## RT-2025-12-23-06 Conflict pipeline not operational (INV-4)

Severity: P0
Component: Conflict detector / Arbiter
Steps to reproduce:

1. Check conflicts: `conflicts_before.txt` shows 0 real conflicts.
2. Insert synthetic conflict and run arbiter.
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-23/conflicts_before.txt
- docs/regulatory-truth/audit-artifacts/2025-12-23/synthetic_conflict_insert.txt
- docs/regulatory-truth/audit-artifacts/2025-12-23/arbiter_run_synthetic.log (fails: missing sourcePointerIds).
  Expected: at least one conflict can be processed by arbiter.
  Actual: no real conflicts; synthetic conflict fails due to missing metadata.
  Root cause hypothesis: no rules with pointers; conflict creation/metadata pipeline incomplete.
  Fix suggestion: ensure conflicts include sourcePointerIds metadata; add synthetic conflict test to CI.
  Acceptance criteria: arbiter resolves or escalates a synthetic conflict with stored rationale.

## RT-2025-12-23-07 Release hash mismatch (INV-5)

Severity: P0
Component: Releaser
Steps to reproduce:

1. Run recompute twice: `tmp/release-hash-prisma.ts`.\n2) Compare stored vs computed hashes.\nEvidence:

- docs/regulatory-truth/audit-artifacts/2025-12-23/release_hash_check_1.json\n- docs/regulatory-truth/audit-artifacts/2025-12-23/release_hash_check_2.json\nExpected: recomputed hash equals stored hash.\nActual: mismatch (stored != computed) for latest release.\nRoot cause hypothesis: release hash computed with different ordering/serialization than recompute; or stored hash derived from different rule set.\nFix suggestion: unify hash computation in one function and use it for both persistence and verification.\nAcceptance criteria: recompute matches stored for the latest release across two runs.\n\n+## RT-2025-12-23-08 Release type mismatch for T0 rules
  Severity: P1
  Component: Releaser
  Steps to reproduce:

1. Run releaser: `npx tsx src/lib/regulatory-truth/scripts/run-releaser.ts`.\nEvidence:

- docs/regulatory-truth/audit-artifacts/2025-12-23/releaser_run.log (LLM release type minor vs expected major).\nExpected: releaseType matches risk-tier policy (T0 => major).\nActual: releaseType minor; warning logged but release proceeds.\nRoot cause hypothesis: LLM release type overrides policy.\nFix suggestion: enforce releaseType derived from risk tiers; block mismatches.\nAcceptance criteria: releaseType enforced; mismatches cause failure.

## RT-2025-12-23-09 T0 rules published via AUTO_APPROVE_SYSTEM (policy mismatch)

Severity: P0
Component: Reviewer/Gates\nSteps to reproduce:\n1) Inspect latest release rules.\nEvidence:\n- docs/regulatory-truth/audit-artifacts/2025-12-23/release_rules_status.txt (T0 rules published with approvedBy=AUTO_APPROVE_SYSTEM).\n- docs/regulatory-truth/audit-artifacts/2025-12-23/reviewer_run_full.log (T0 mandates human approval).\nExpected: T0 rules require human approval per authority matrix.\nActual: T0 rules published with AUTO_APPROVE_SYSTEM approval.\nRoot cause hypothesis: legacy auto-approval path bypasses current policy.\nFix suggestion: enforce T0 human approval gate at reviewer/releaser; reject AUTO_APPROVE_SYSTEM for T0.\nAcceptance criteria: no T0 rules published with AUTO_APPROVE_SYSTEM.\n\n+## RT-2025-12-23-10 Assistant citations missing (INV-6)
Severity: P0
Component: Assistant
Steps to reproduce:

1. Run assistant suite against http://127.0.0.1:3000.
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-23/assistant_test_suite.json (URL compliance 10%).
  Expected: every regulatory answer includes rule id + source URL + quote or refuses.
  Actual: citations missing in most answers.
  Root cause hypothesis: assistant response path not wired to evidence/rule retrieval.
  Fix suggestion: enforce citation injection; block responses without evidence.
  Acceptance criteria: >=95% citation compliance; 0 uncited regulatory claims.

## RT-2025-12-23-11 Assistant reliability failures

Severity: P1
Component: Assistant
Steps to reproduce:

1. Run assistant suite.
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-23/assistant_test_suite.json (23/30 AbortError).
  Expected: error rate <5%.
  Actual: 23/30 requests aborted.
  Root cause hypothesis: latency/timeouts or backend instability.
  Fix suggestion: instrument latency, add retries, increase timeout, fix backend bottlenecks.
  Acceptance criteria: error rate <5%; p95 latency within SLO.

## RT-2025-12-23-12 Sentinel idempotency ambiguity

Severity: P2
Component: Sentinel
Steps to reproduce:

1. Compare evidence counts pre/post sentinel runs.
   Evidence:

- docs/regulatory-truth/audit-artifacts/2025-12-23/evidence_count_before.txt
- docs/regulatory-truth/audit-artifacts/2025-12-23/evidence_count_after_1.txt
- docs/regulatory-truth/audit-artifacts/2025-12-23/evidence_count_after_2.txt
  Expected: no new evidence on immediate re-run when no new items discovered.
  Actual: evidence count increases after run 2 despite 0 new items (likely pending fetches).
  Root cause hypothesis: fetch queue completion occurs after run1; re-run still writes evidence.
  Fix suggestion: report pending fetch count; separate discovery from fetch completion in metrics.
  Acceptance criteria: idempotency metrics include pending fetch backlog; re-run shows zero new evidence for unchanged content.
