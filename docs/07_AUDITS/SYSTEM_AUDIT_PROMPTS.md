# Regulatory Truth Layer - AI Agent Audit Prompts

> **Purpose:** Comprehensive audit prompts for AI agents to evaluate each stage of the Regulatory Truth pipeline.
>
> **Usage:** Feed each section to an AI auditor agent with access to the codebase, database, and logs.

---

## Audit Overview

| # | Stage | Risk Level | Key Files | Primary Concern |
|---|-------|------------|-----------|-----------------|
| 1 | Sentinel | Medium | `agents/sentinel.ts` | Source coverage, fetch reliability |
| 2 | OCR | Medium | `workers/ocr.worker.ts` | Text extraction accuracy |
| 3 | Extractor | **Critical** | `agents/extractor.ts` | Quote fidelity, no hallucinations |
| 4 | Composer | **Critical** | `agents/composer.ts` | Rule correctness, conflict detection |
| 5 | Reviewer | High | `agents/reviewer.ts` | Quality gate effectiveness |
| 6 | Arbiter | High | `agents/arbiter.ts` | Conflict resolution correctness |
| 7 | Releaser | High | `agents/releaser.ts` | Publication safety, versioning |
| 8 | Assistant | **Critical** | `retrieval/*.ts` | Answer accuracy, citation validity |

---

## AUDIT 1: Sentinel (Discovery)

### Purpose
Validates that the Sentinel agent correctly discovers, fetches, and classifies regulatory content from all registered sources.

### Audit Prompt

```
You are auditing the Sentinel discovery stage of a Regulatory Truth system.

OBJECTIVE: Verify that Sentinel correctly discovers and ingests regulatory content.

KEY FILES TO REVIEW:
- src/lib/regulatory-truth/agents/sentinel.ts
- src/lib/regulatory-truth/parsers/sitemap-parser.ts
- src/lib/regulatory-truth/parsers/html-list-parser.ts

DATABASE QUERIES TO RUN:
1. SELECT COUNT(*), status FROM "DiscoveredItem" GROUP BY status;
2. SELECT name, "lastCheckedAt", "checkIntervalHours" FROM "RegulatorySource" WHERE enabled = true ORDER BY "lastCheckedAt" ASC LIMIT 10;
3. SELECT de.url, de."listingStrategy", COUNT(di.id) as items FROM "DiscoveryEndpoint" de LEFT JOIN "DiscoveredItem" di ON di."endpointId" = de.id GROUP BY de.id ORDER BY items DESC LIMIT 20;
4. SELECT "contentClass", COUNT(*) FROM "Evidence" GROUP BY "contentClass";

CHECKS TO PERFORM:

1. SOURCE COVERAGE
   - Are all critical sources (Porezna uprava, FINA, Narodne novine, HNB) registered and enabled?
   - Are check intervals appropriate for source update frequency?
   - Are any sources stale (not checked in >7 days)?

2. FETCH RELIABILITY
   - What is the success rate for fetches in the last 24h?
   - Are there repeated fetch failures for any endpoint?
   - Is rate limiting properly applied per domain?

3. CONTENT CLASSIFICATION
   - Are PDFs correctly classified as PDF_TEXT vs PDF_SCANNED?
   - Are HTML pages properly detected vs binary files?
   - Are there Evidence records stuck in unprocessed state?

4. DEDUPLICATION
   - Are duplicate URLs being filtered?
   - Is the canonicalization logic working (trailing slashes, query params)?

5. ERROR HANDLING
   - Are 404/500 errors logged and not retried infinitely?
   - Are redirect chains followed correctly?
   - Is there a circuit breaker for consistently failing sources?

SPECIFIC TEST CASES:
- Find an Evidence record from each critical source and verify rawContent is populated
- Check for DiscoveredItems in PENDING status older than 24h (should be 0)
- Verify no Evidence records have empty rawContent

OUTPUT FORMAT:
Provide findings as:
- PASS: [description]
- WARN: [description] - [recommendation]
- FAIL: [description] - [severity: LOW/MEDIUM/HIGH/CRITICAL]

Include specific IDs and counts where applicable.
```

---

## AUDIT 2: OCR (Text Extraction)

### Purpose
Validates that scanned PDFs are correctly processed through OCR to produce accurate text artifacts.

### Audit Prompt

```
You are auditing the OCR processing stage of a Regulatory Truth system.

OBJECTIVE: Verify that OCR correctly extracts text from scanned PDFs with acceptable accuracy.

KEY FILES TO REVIEW:
- src/lib/regulatory-truth/workers/ocr.worker.ts
- src/lib/regulatory-truth/utils/pdf-classifier.ts

DATABASE QUERIES TO RUN:
1. SELECT COUNT(*) FROM "Evidence" WHERE "contentClass" = 'PDF_SCANNED' AND status = 'PENDING';
2. SELECT e.id, e."contentClass", ea.kind, LENGTH(ea.content) as artifact_len FROM "Evidence" e LEFT JOIN "EvidenceArtifact" ea ON ea."evidenceId" = e.id WHERE e."contentClass" = 'PDF_SCANNED' LIMIT 20;
3. SELECT COUNT(*), kind FROM "EvidenceArtifact" GROUP BY kind;
4. SELECT id, error, "createdAt" FROM "Evidence" WHERE "contentClass" = 'PDF_SCANNED' AND status = 'FAILED' ORDER BY "createdAt" DESC LIMIT 10;

CHECKS TO PERFORM:

1. OCR QUEUE HEALTH
   - How many PDF_SCANNED items are awaiting OCR?
   - What is the average processing time per document?
   - Are there stuck jobs in the OCR queue?

2. ARTIFACT GENERATION
   - Does every PDF_SCANNED Evidence have an OCR_TEXT artifact?
   - Are OCR_HOCR (with coordinates) artifacts being generated for table extraction?
   - Is artifact content non-empty and reasonable length?

3. TEXT QUALITY (sample 5 random OCR_TEXT artifacts)
   - Is the extracted text readable and coherent?
   - Are Croatian diacritics (č, ć, š, ž, đ) correctly recognized?
   - Are numbers and percentages accurately extracted?
   - Are tables preserved in some structured format?

4. FALLBACK HANDLING
   - When Tesseract fails, is Vision API fallback triggered?
   - Are Vision API failures logged with context?
   - Is there a maximum retry limit?

5. PERFORMANCE
   - Are large PDFs (>50 pages) being chunked?
   - Is memory usage bounded during processing?
   - Are timeout limits appropriate?

SPECIFIC TEST CASES:
- Find a PDF_SCANNED Evidence with OCR_TEXT artifact, verify text matches visible PDF content
- Check for Evidence stuck in 'PROCESSING' status for >1 hour
- Verify OCR artifacts preserve numerical values exactly

QUALITY METRICS:
- OCR queue backlog should be <100 items
- Failed OCR rate should be <5%
- Average OCR processing time should be <60s per page

OUTPUT FORMAT:
- PASS/WARN/FAIL with specific counts and IDs
- For WARN/FAIL, include sample evidence IDs for manual review
```

---

## AUDIT 3: Extractor (Fact Extraction)

### Purpose
**CRITICAL AUDIT** - Validates that the LLM extractor produces accurate facts with verifiable quotes and no hallucinations.

### Audit Prompt

```
You are auditing the Extractor stage of a Regulatory Truth system. This is a CRITICAL audit as extraction errors can propagate hallucinations into published rules.

OBJECTIVE: Verify that extracted SourcePointers contain accurate values with exact quotes from source documents.

KEY FILES TO REVIEW:
- src/lib/regulatory-truth/agents/extractor.ts
- src/lib/regulatory-truth/schemas/extractor.ts
- src/lib/regulatory-truth/utils/deterministic-validators.ts
- src/lib/regulatory-truth/quality/coverage-report.ts

DATABASE QUERIES TO RUN:
1. SELECT domain, COUNT(*), AVG(confidence) FROM "SourcePointer" GROUP BY domain ORDER BY COUNT(*) DESC;
2. SELECT type, COUNT(*) FROM "ExtractionRejected" GROUP BY type;
3. SELECT sp.id, sp."extractedValue", sp."exactQuote", sp.confidence, e.id as evidence_id FROM "SourcePointer" sp JOIN "Evidence" e ON sp."evidenceId" = e.id ORDER BY sp."createdAt" DESC LIMIT 20;
4. SELECT "contentType", "coverageScore", "missingShapes" FROM "CoverageReport" WHERE "coverageScore" < 0.5 LIMIT 10;

CHECKS TO PERFORM:

1. QUOTE VERIFICATION (CRITICAL - sample 10 random SourcePointers)
   For each SourcePointer:
   - Retrieve the associated Evidence.rawContent or EvidenceArtifact
   - Verify that exactQuote appears VERBATIM in the source
   - Verify that extractedValue is correctly derived from the quote
   - Flag any quote that cannot be found (hallucination indicator)

2. VALUE VALIDATION
   - Are percentages in range 0-100?
   - Are currency values within reasonable bounds?
   - Are dates in valid ISO format (YYYY-MM-DD)?
   - Are threshold values numerically parseable?

3. DEAD-LETTER ANALYSIS
   - What is the rejection rate by type?
   - Are NO_QUOTE_MATCH rejections indicating extraction problems?
   - Are OUT_OF_RANGE rejections catching invalid values?
   - Review 5 recent rejections - are they correctly rejected?

4. CONFIDENCE CALIBRATION
   - What is the distribution of confidence scores?
   - Are low-confidence (<0.7) pointers flagged for review?
   - Do high-confidence pointers actually have verifiable quotes?

5. DOMAIN COVERAGE
   - Are all critical domains represented (pausalni, pdv, doprinosi, porez-na-dohodak)?
   - Are any domains suspiciously under-represented?

6. COVERAGE REPORTS
   - What percentage of Evidence has coverageScore > 0.7?
   - Are there patterns in low-coverage content types?
   - Are MIXED/GENERAL content types being handled?

SPECIFIC TEST CASES:
- SELECT 3 SourcePointers with confidence > 0.95, verify quotes exist in source
- SELECT 3 SourcePointers with confidence < 0.7, verify they're appropriately uncertain
- Check for SourcePointers where extractedValue contains the word "approximately" or "oko" (should be exact)

HALLUCINATION DETECTION:
Run this query and manually verify each result:
SELECT sp.id, sp."exactQuote", sp."extractedValue"
FROM "SourcePointer" sp
WHERE sp.confidence > 0.9
AND sp."createdAt" > NOW() - INTERVAL '7 days'
ORDER BY RANDOM() LIMIT 10;

For EACH result, verify the quote exists in the source document.

OUTPUT FORMAT:
- PASS: Quote verification passed for X/Y samples
- FAIL: HALLUCINATION DETECTED - SourcePointer ID [X] has fabricated quote
- Include specific IDs for any failed checks
```

---

## AUDIT 4: Composer (Rule Composition)

### Purpose
**CRITICAL AUDIT** - Validates that composed RegulatoryRules correctly synthesize SourcePointers into accurate, non-conflicting rules.

### Audit Prompt

```
You are auditing the Composer stage of a Regulatory Truth system. This is CRITICAL as rule composition errors affect all downstream consumers.

OBJECTIVE: Verify that RegulatoryRules are correctly composed from SourcePointers with proper conflict detection.

KEY FILES TO REVIEW:
- src/lib/regulatory-truth/agents/composer.ts
- src/lib/regulatory-truth/schemas/composer.ts
- src/lib/regulatory-truth/utils/conflict-detector.ts
- src/lib/regulatory-truth/utils/meaning-signature.ts
- src/lib/regulatory-truth/taxonomy/concept-resolver.ts

DATABASE QUERIES TO RUN:
1. SELECT status, COUNT(*) FROM "RegulatoryRule" GROUP BY status;
2. SELECT "riskTier", COUNT(*), AVG(LENGTH("explanationHr")) as avg_expl_len FROM "RegulatoryRule" GROUP BY "riskTier";
3. SELECT rr.id, rr."conceptSlug", rr.value, rr."valueType", COUNT(sp.id) as pointer_count FROM "RegulatoryRule" rr LEFT JOIN "SourcePointer" sp ON sp."ruleId" = rr.id GROUP BY rr.id ORDER BY pointer_count ASC LIMIT 20;
4. SELECT status, "conflictType", COUNT(*) FROM "RegulatoryConflict" GROUP BY status, "conflictType";
5. SELECT id, "conceptSlug", value, "authorityLevel" FROM "RegulatoryRule" WHERE status = 'DRAFT' AND "riskTier" IN ('T0', 'T1') ORDER BY "createdAt" DESC LIMIT 10;

CHECKS TO PERFORM:

1. RULE-POINTER LINKAGE
   - Do all rules have at least one SourcePointer?
   - Are single-source rules flagged appropriately?
   - Are multi-source rules actually corroborated (same value from different sources)?

2. CONCEPT RESOLUTION
   - Are conceptSlugs following kebab-case convention?
   - Are alias concepts correctly resolved to canonical concepts?
   - Are there orphaned concepts with no linked rules?

3. VALUE CONSISTENCY (sample 5 rules)
   - Does the rule value match its SourcePointer extractedValues?
   - Is the valueType appropriate (percentage vs currency vs threshold)?
   - Are effectiveFrom/effectiveUntil dates valid and logical?

4. CONFLICT DETECTION
   - Are VALUE_MISMATCH conflicts being detected when pointers disagree?
   - Are DATE_OVERLAP conflicts detected for overlapping validity periods?
   - Are AUTHORITY_SUPERSEDE conflicts detected when higher authority contradicts lower?

5. RISK TIER ASSIGNMENT
   - Are T0 rules correctly identified (core tax rates, critical thresholds)?
   - Are T3 rules actually low-impact (procedural guidance)?
   - Is the distribution of tiers reasonable?

6. APPLIES-WHEN VALIDATION
   - Are appliesWhen conditions syntactically valid DSL?
   - Do conditions reference real fields (revenue, tax_status, etc.)?
   - Are conditions testable with sample data?

7. DEDUPLICATION
   - Are meaningSignatures unique per published rule?
   - Are there duplicate rules with same (concept + value + dates)?
   - Is the merge logic working for similar rules?

SPECIFIC TEST CASES:
- Find a T0 rule (pausalni threshold), verify value matches Porezna uprava source
- Find a rule with 3+ SourcePointers, verify all pointers agree on value
- Find an OPEN conflict, verify conflicting rules are correctly identified

CONSISTENCY CHECK:
For 3 random PUBLISHED rules:
1. Retrieve all linked SourcePointers
2. Retrieve Evidence for each pointer
3. Verify rule.value is derivable from the source documents
4. Verify explanationHr does not contain information not in sources

OUTPUT FORMAT:
- PASS/WARN/FAIL with specific rule IDs
- For conflicts: list conflict IDs and types
- For inconsistencies: show rule value vs source values
```

---

## AUDIT 5: Reviewer (Quality Checks)

### Purpose
Validates that the Reviewer stage correctly filters rules and applies quality gates consistently.

### Audit Prompt

```
You are auditing the Reviewer quality gate of a Regulatory Truth system.

OBJECTIVE: Verify that quality gates are correctly applied and no invalid rules pass through.

KEY FILES TO REVIEW:
- src/lib/regulatory-truth/agents/reviewer.ts
- src/lib/regulatory-truth/schemas/reviewer.ts
- src/lib/regulatory-truth/quality/coverage-gate.ts
- src/lib/regulatory-truth/utils/health-gates.ts

DATABASE QUERIES TO RUN:
1. SELECT status, COUNT(*) FROM "RegulatoryRule" WHERE status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED') GROUP BY status;
2. SELECT id, "conceptSlug", "riskTier", "rejectionReason" FROM "RegulatoryRule" WHERE status = 'REJECTED' ORDER BY "updatedAt" DESC LIMIT 10;
3. SELECT id, "conceptSlug", "riskTier", "autoApproved", "approvedAt" FROM "RegulatoryRule" WHERE status = 'APPROVED' ORDER BY "approvedAt" DESC LIMIT 20;
4. SELECT rr.id, rr."riskTier", COUNT(sp.id) as sources FROM "RegulatoryRule" rr LEFT JOIN "SourcePointer" sp ON sp."ruleId" = rr.id WHERE rr.status = 'APPROVED' GROUP BY rr.id HAVING COUNT(sp.id) = 1;

CHECKS TO PERFORM:

1. AUTO-APPROVAL SAFETY
   - Verify NO T0 or T1 rules were auto-approved (CRITICAL)
   - Are auto-approved rules all T2/T3?
   - Do auto-approved rules have confidence >= 0.90?
   - Do auto-approved rules have no open conflicts?

2. REJECTION ANALYSIS
   - Are rejection reasons meaningful and actionable?
   - What percentage of rules are rejected?
   - Are rejections being re-submitted after fixes?

3. PENDING REVIEW QUEUE
   - How many rules are awaiting review?
   - What is the average time in PENDING_REVIEW?
   - Are T0/T1 rules being prioritized?

4. EVIDENCE STRENGTH
   - Are single-source rules for non-LAW authority blocked?
   - Are multi-source rules correctly prioritized?
   - Is the minimum source threshold (2) enforced for T0/T1?

5. CITATION COMPLIANCE
   - Are explanations traceable to source quotes?
   - Are there rules with explanations containing unsourced claims?
   - Is the citation format consistent?

6. QUALITY GATE CONSISTENCY
   - Run the same rule through reviewer twice - same result?
   - Are edge cases handled consistently?
   - Is the 24h grace period being enforced?

SPECIFIC TEST CASES:
- Verify that ALL APPROVED T0/T1 rules have manual approval (not auto)
- Find a REJECTED rule and verify rejection reason is valid
- Find an auto-approved T3 rule and verify it meets all criteria

CRITICAL CHECK:
Query for any T0/T1 rules that were auto-approved:
SELECT id, "conceptSlug", "riskTier", "autoApproved"
FROM "RegulatoryRule"
WHERE "riskTier" IN ('T0', 'T1') AND "autoApproved" = true;

This should return 0 rows. Any results are CRITICAL failures.

OUTPUT FORMAT:
- PASS: Auto-approval safety verified (0 T0/T1 auto-approved)
- FAIL: CRITICAL - T0/T1 rule [ID] was auto-approved
- Include queue statistics and rejection rate
```

---

## AUDIT 6: Arbiter (Conflict Resolution)

### Purpose
Validates that conflicts are correctly detected, prioritized, and resolved using proper authority hierarchy.

### Audit Prompt

```
You are auditing the Arbiter conflict resolution stage of a Regulatory Truth system.

OBJECTIVE: Verify that regulatory conflicts are correctly identified and resolved.

KEY FILES TO REVIEW:
- src/lib/regulatory-truth/agents/arbiter.ts
- src/lib/regulatory-truth/schemas/arbiter.ts
- src/lib/regulatory-truth/utils/conflict-detector.ts
- src/lib/regulatory-truth/taxonomy/graph-edges.ts

DATABASE QUERIES TO RUN:
1. SELECT status, "conflictType", "resolutionStrategy", COUNT(*) FROM "RegulatoryConflict" GROUP BY status, "conflictType", "resolutionStrategy";
2. SELECT id, "conflictType", "ruleAId", "ruleBId", status, "resolutionStrategy" FROM "RegulatoryConflict" WHERE status = 'OPEN' ORDER BY "createdAt" ASC LIMIT 10;
3. SELECT rc.id, ra."authorityLevel" as auth_a, rb."authorityLevel" as auth_b, rc."resolutionStrategy" FROM "RegulatoryConflict" rc JOIN "RegulatoryRule" ra ON rc."ruleAId" = ra.id JOIN "RegulatoryRule" rb ON rc."ruleBId" = rb.id WHERE rc.status = 'RESOLVED' LIMIT 20;
4. SELECT id, "conflictType", "escalationReason" FROM "RegulatoryConflict" WHERE status = 'ESCALATED' ORDER BY "createdAt" DESC LIMIT 10;

CHECKS TO PERFORM:

1. OPEN CONFLICT BACKLOG
   - How many conflicts are OPEN?
   - What is the oldest unresolved conflict?
   - Are T0/T1 rule conflicts prioritized?

2. RESOLUTION STRATEGY VALIDATION (sample 5 resolved conflicts)
   - Was the correct authority hierarchy applied?
   - LAW (1) > GUIDANCE (2) > PROCEDURE (3) > PRACTICE (4)
   - Did higher authority correctly prevail?
   - Was temporal precedence (later > earlier) applied correctly?

3. ESCALATION APPROPRIATENESS
   - Are escalated conflicts truly ambiguous?
   - Review escalation reasons - are they valid?
   - What is the escalation rate (should be <10%)?

4. GRAPH EDGE CONSISTENCY
   - Are AMENDS/SUPERSEDES edges correctly created after resolution?
   - Are deprecated rules marked with supersededBy reference?
   - Is the rule graph acyclic (no circular supersession)?

5. MERGE RESOLUTION QUALITY
   - For MERGE_RULES resolutions, verify the merged rule is valid
   - Are both source conditions preserved in appliesWhen?
   - Is the merged value logically consistent?

6. FALSE POSITIVE DETECTION
   - Are there conflicts between rules that don't actually conflict?
   - Check for conflicts with same value but different wording
   - Verify conflictType matches actual conflict nature

SPECIFIC TEST CASES:
- Find a VALUE_MISMATCH conflict, verify the values actually differ
- Find an AUTHORITY_SUPERSEDE resolution, verify LAW beat GUIDANCE
- Find an ESCALATED conflict, assess if escalation was necessary

AUTHORITY HIERARCHY CHECK:
For all RESOLVED conflicts:
SELECT rc.id,
       ra."authorityLevel" as rule_a_auth,
       rb."authorityLevel" as rule_b_auth,
       rc."resolutionStrategy"
FROM "RegulatoryConflict" rc
JOIN "RegulatoryRule" ra ON rc."ruleAId" = ra.id
JOIN "RegulatoryRule" rb ON rc."ruleBId" = rb.id
WHERE rc.status = 'RESOLVED'
AND rc."resolutionStrategy" = 'RULE_A_PREVAILS'
AND ra."authorityLevel" > rb."authorityLevel";

This should return 0 rows (lower auth shouldn't prevail).

OUTPUT FORMAT:
- PASS/WARN/FAIL with conflict statistics
- List any hierarchy violations
- Note escalation rate and backlog age
```

---

## AUDIT 7: Releaser (Publication)

### Purpose
Validates that only properly reviewed rules are published with correct versioning and audit trails.

### Audit Prompt

```
You are auditing the Releaser publication stage of a Regulatory Truth system.

OBJECTIVE: Verify that publication gates are enforced and releases are properly versioned.

KEY FILES TO REVIEW:
- src/lib/regulatory-truth/agents/releaser.ts
- src/lib/regulatory-truth/schemas/releaser.ts
- src/lib/regulatory-truth/quality/publish-gate.ts
- src/lib/regulatory-truth/utils/audit-log.ts

DATABASE QUERIES TO RUN:
1. SELECT version, "createdAt", "ruleCount", "contentHash" FROM "RuleRelease" ORDER BY "createdAt" DESC LIMIT 10;
2. SELECT id, "conceptSlug", "riskTier", "publishedAt" FROM "RegulatoryRule" WHERE status = 'PUBLISHED' ORDER BY "publishedAt" DESC LIMIT 20;
3. SELECT rr.id, rr."riskTier", rr."authorityLevel", COUNT(sp.id) as sources FROM "RegulatoryRule" rr LEFT JOIN "SourcePointer" sp ON sp."ruleId" = rr.id WHERE rr.status = 'PUBLISHED' GROUP BY rr.id HAVING COUNT(sp.id) = 1;
4. SELECT action, "entityType", COUNT(*) FROM "RegulatoryAuditLog" WHERE "createdAt" > NOW() - INTERVAL '7 days' GROUP BY action, "entityType";

CHECKS TO PERFORM:

1. PUBLISH GATE ENFORCEMENT
   - Were all published rules in APPROVED status before publication?
   - Are there any DRAFT or PENDING_REVIEW rules that are PUBLISHED? (CRITICAL)
   - Is evidence strength gate enforced (single-source only if LAW)?

2. VERSIONING CORRECTNESS
   - Is semver being applied correctly?
   - T0 changes → major bump (1.0.0 → 2.0.0)?
   - T1 changes → minor bump (1.0.0 → 1.1.0)?
   - T2/T3 changes → patch bump (1.0.0 → 1.0.1)?
   - Are version numbers monotonically increasing?

3. CONTENT HASH INTEGRITY
   - Is contentHash unique per release?
   - Does recalculating hash for rules match stored hash?
   - Are there duplicate releases with same content?

4. AUDIT TRAIL COMPLETENESS
   - Does every PUBLISHED rule have a RegulatoryAuditLog entry?
   - Are approver IDs recorded?
   - Is the approval timestamp recorded?

5. RELEASE METADATA
   - Are changelogs generated and meaningful?
   - Is sourceEvidenceCount accurate?
   - Is the auditTrail JSON complete?

6. ROLLBACK SAFETY
   - Are previous rule versions preserved?
   - Can a release be rolled back?
   - Are superseded rules still queryable for historical reference?

SPECIFIC TEST CASES:
- Find the latest release, verify all included rules are APPROVED
- Find a single-source PUBLISHED rule, verify authorityLevel = LAW
- Verify the last 5 version bumps follow semver based on riskTier

CRITICAL CHECK - NO UNAPPROVED PUBLICATIONS:
SELECT id, "conceptSlug", status, "publishedAt"
FROM "RegulatoryRule"
WHERE status != 'PUBLISHED' AND "publishedAt" IS NOT NULL;

This should return 0 rows.

EVIDENCE STRENGTH CHECK:
SELECT rr.id, rr."conceptSlug", rr."authorityLevel", COUNT(sp.id) as sources
FROM "RegulatoryRule" rr
LEFT JOIN "SourcePointer" sp ON sp."ruleId" = rr.id
WHERE rr.status = 'PUBLISHED'
AND rr."authorityLevel" != 'LAW'
GROUP BY rr.id
HAVING COUNT(sp.id) = 1;

Non-LAW single-source rules should not be published.

OUTPUT FORMAT:
- PASS/WARN/FAIL with release statistics
- List any gate violations
- Include version history analysis
```

---

## AUDIT 8: Assistant (Query Answering)

### Purpose
**CRITICAL AUDIT** - Validates that the AI assistant provides accurate answers with valid citations and refuses appropriately when evidence is insufficient.

### Audit Prompt

```
You are auditing the Assistant query-answering stage of a Regulatory Truth system. This is CRITICAL as end-users rely on these answers for regulatory compliance.

OBJECTIVE: Verify that assistant answers are accurate, properly cited, and refuse when evidence is insufficient.

KEY FILES TO REVIEW:
- src/lib/regulatory-truth/retrieval/query-router.ts
- src/lib/regulatory-truth/retrieval/logic-engine.ts
- src/lib/regulatory-truth/retrieval/process-engine.ts
- src/lib/regulatory-truth/retrieval/reference-engine.ts
- src/lib/regulatory-truth/retrieval/temporal-engine.ts
- src/app/api/assistant/chat/route.ts

DATABASE QUERIES TO RUN:
1. SELECT "responseType", COUNT(*) FROM "AssistantInteraction" GROUP BY "responseType";
2. SELECT id, query, "responseType", "citedRuleIds" FROM "AssistantInteraction" WHERE "responseType" = 'ANSWER' ORDER BY "createdAt" DESC LIMIT 10;
3. SELECT id, query, "refusalReason" FROM "AssistantInteraction" WHERE "responseType" = 'REFUSAL' ORDER BY "createdAt" DESC LIMIT 10;
4. SELECT rr.id, rr."conceptSlug", COUNT(ai.id) as citation_count FROM "RegulatoryRule" rr LEFT JOIN "AssistantInteraction" ai ON rr.id = ANY(ai."citedRuleIds") GROUP BY rr.id ORDER BY citation_count DESC LIMIT 20;

CHECKS TO PERFORM:

1. QUERY ROUTING ACCURACY
   - Is intent detection (LOGIC/PROCESS/REFERENCE/DOCUMENT) correct?
   - Are ambiguous queries handled appropriately?
   - Is the router using patterns vs LLM efficiently?

2. ANSWER VERIFICATION (sample 5 ANSWER responses)
   For each answer:
   - Retrieve the cited rules
   - Retrieve the SourcePointers for those rules
   - Verify the answer content matches rule values
   - Verify citations are for PUBLISHED rules only
   - Check for any claims not backed by cited rules

3. CITATION VALIDITY
   - Are all cited rules in PUBLISHED status?
   - Are citations to the most recent rule version?
   - Are there answers citing deprecated/superseded rules?

4. REFUSAL APPROPRIATENESS (sample 5 REFUSAL responses)
   - Is the refusal reason valid (NO_CITABLE_RULES, LOW_CONFIDENCE)?
   - Could the query have been answered with available rules?
   - Is the refusal message helpful to the user?

5. QUALIFIED ANSWER HANDLING
   - Are conditions/exceptions clearly stated?
   - Is the "applies when" logic correctly explained?
   - Are edge cases acknowledged?

6. TEMPORAL CORRECTNESS
   - Are answers using currently-effective rules?
   - Are expired rules excluded from answers?
   - Is effectiveFrom/effectiveUntil respected?

7. FAIL-CLOSED VERIFICATION
   - Does the system refuse rather than hallucinate?
   - Are low-confidence answers marked as uncertain?
   - Is there a minimum confidence threshold?

TEST QUERIES TO RUN:
Execute these queries through the assistant and verify:

1. "Koliki je limit prihoda za paušalni obrt?" (pausalni threshold)
   - Should cite T0 pausalni-revenue-threshold rule
   - Value should match current legal threshold

2. "Koja je stopa PDV-a?" (VAT rate)
   - Should cite T0 pdv-standard-rate rule
   - Should mention reduced rates if applicable

3. "Kako registrirati paušalni obrt?" (process query)
   - Should return step-by-step process
   - Each step should be cited

4. "Koji je IBAN za uplatu poreza?" (reference query)
   - Should return from ReferenceTable
   - Should cite authoritative source

5. "Kolika je stopa poreza na Marsu?" (unanswerable)
   - Should REFUSE with NO_CITABLE_RULES
   - Should NOT hallucinate an answer

HALLUCINATION DETECTION:
For each ANSWER response:
1. Parse all factual claims in the response
2. Verify each claim is present in a cited rule
3. Flag any claims not traceable to citations

CRITICAL CHECK - NO UNPUBLISHED CITATIONS:
Review citedRuleIds for any rule not in PUBLISHED status:
SELECT ai.id, ai.query, rr.id as rule_id, rr.status
FROM "AssistantInteraction" ai
CROSS JOIN UNNEST(ai."citedRuleIds") as cited_id
JOIN "RegulatoryRule" rr ON rr.id = cited_id
WHERE rr.status != 'PUBLISHED';

This should return 0 rows.

OUTPUT FORMAT:
- PASS/WARN/FAIL with query sample results
- Include specific query/answer pairs that failed verification
- Note refusal rate and appropriateness
- Flag any hallucinations detected
```

---

## Audit Execution Checklist

Before running audits, verify:

- [ ] Database access is available (read-only recommended)
- [ ] Log access is available for the last 7 days
- [ ] Queue status can be queried (BullMQ dashboard or CLI)
- [ ] Sample Evidence documents can be retrieved for quote verification
- [ ] Test queries can be executed through the assistant API

## Audit Schedule

| Audit | Frequency | Trigger Conditions |
|-------|-----------|-------------------|
| Sentinel | Weekly | After source list changes |
| OCR | Weekly | After OCR config changes |
| Extractor | **Daily** | Any extraction, new sources |
| Composer | **Daily** | After rule composition |
| Reviewer | Weekly | After auto-approval threshold changes |
| Arbiter | Weekly | When conflict queue > 50 |
| Releaser | Per-release | Before major/minor releases |
| Assistant | **Daily** | Continuous sampling |

## Severity Definitions

- **CRITICAL**: Immediate action required. Hallucinations, unpublished citations, T0/T1 auto-approval.
- **HIGH**: Action within 24h. Missing evidence, authority violations, stale queues.
- **MEDIUM**: Action within 7 days. Quality degradation, performance issues.
- **LOW**: Track for trends. Minor inconsistencies, cosmetic issues.

---

*Document version: 1.0*
*Created: 2024-12-27*
*Maintainer: Platform Engineering*
