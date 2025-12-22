# Extractor Agent Failure Analysis

**Date:** 2025-12-22
**Issue:** 88% extractor failure rate (74/84 attempts failed)

---

## Error Distribution

| Error Type            | Count | Percentage | Root Cause                  |
| --------------------- | ----- | ---------- | --------------------------- |
| **429 Rate Limiting** | 61    | 82%        | API overload                |
| No JSON Found         | 6     | 8%         | Model outputs thinking text |
| Timeout/Stuck         | 5     | 7%         | Connection issues           |
| Invalid Schema        | 2     | 3%         | Missing required fields     |
| Truncated JSON        | 1     | 1%         | Response cut off            |

---

## Root Cause #1: API Rate Limiting (82% of failures)

**Symptom:**

```
Agent failed after 3 attempts: Ollama API error: 429 Too Many Requests
```

**Cause:**
The `runExtractorBatch()` function processes evidence records in a loop without adequate delay:

```typescript
// extractor.ts line 110-147
for (const evidence of unprocessedEvidence) {
  try {
    const result = await runExtractor(evidence.id)  // <-- No delay between calls!
    ...
  }
}
```

**Current Retry Logic (runner.ts:214-221):**

```typescript
const isRateLimit = lastError?.message?.includes("429")
const baseDelay = isRateLimit ? 30000 : 1000 // 30s for rate limits
const delay = Math.pow(2, attempt) * baseDelay
await new Promise((resolve) => setTimeout(resolve, delay))
```

This only kicks in AFTER a failure. By then, 61 requests have already been rejected.

**Fix:**
Add pre-emptive rate limiting:

```typescript
// In runExtractorBatch
for (const evidence of unprocessedEvidence) {
  await new Promise((r) => setTimeout(r, 5000)) // 5s delay BEFORE each call
  const result = await runExtractor(evidence.id)
}
```

---

## Root Cause #2: Model Thinking Text (8% of failures)

**Symptom:**

```
No JSON object found in response: Okay, let's tackle this. The user wants me to
extract specific regulatory values, thresholds, rates, and deadlines from the
provided evidence...
```

**Cause:**
The model (qwen3-next / gemini-3-flash-preview) sometimes outputs reasoning text before (or instead of) JSON. The current parsing logic tries to handle this:

```typescript
// runner.ts:148-168
let rawContent = data.message?.content || ""
if (!rawContent && data.message?.thinking) {
  rawContent = data.message.thinking
}

// Try to find JSON object in response
const jsonMatch = jsonContent.match(/\{[\s\S]*\}/)
if (!jsonMatch) {
  throw new Error(`No JSON object found in response: ${rawContent.slice(0, 200)}`)
}
```

**Problem:**

1. The regex `/\{[\s\S]*\}/` should work, but if there's no `{...}` at all, it fails
2. Some models put thinking in content, not in a separate `thinking` field
3. The model may genuinely not produce JSON (misunderstanding the prompt)

**Fix:**
More aggressive prompt engineering:

```typescript
// Add to system prompt in runner.ts:127-129
content: systemPrompt +
  "\n\nCRITICAL: Your response must be ONLY valid JSON. " +
  "No thinking, no explanation, no markdown code blocks, just the raw JSON object. " +
  "Start your response with { and end with }. Do NOT include any text before the JSON."
```

---

## Root Cause #3: Schema Validation Too Strict (3% of failures)

**Symptom:**

```
Invalid output: [
  { "path": ["evidence_id"], "message": "expected string, received undefined" },
  { "path": ["extractions"], "message": "expected array, received undefined" },
  { "path": ["extraction_metadata"], "message": "expected object, received undefined" }
]
```

**Cause:**
The model returns valid JSON but misses required top-level fields. The schema (schemas/extractor.ts) requires:

- `evidence_id` (required string)
- `extractions` (required array)
- `extraction_metadata` (required object)

If the model outputs just `{ "extractions": [...] }` without the other fields, validation fails.

**Current Schema:**

```typescript
export const ExtractorOutputSchema = z.object({
  evidence_id: z.string(),  // Required
  extractions: z.array(ExtractionItemSchema),  // Required
  extraction_metadata: z.object({...}),  // Required
})
```

**Fix Option 1 - Make fields optional with defaults:**

```typescript
export const ExtractorOutputSchema = z.object({
  evidence_id: z.string().optional().default(""),
  extractions: z.array(ExtractionItemSchema).default([]),
  extraction_metadata: z.object({...}).optional().default({
    total_extractions: 0,
    by_domain: {},
    low_confidence_count: 0,
    processing_notes: "Auto-filled"
  }),
})
```

**Fix Option 2 - Fill missing fields in code:**

```typescript
// In runner.ts after parsing
parsed.evidence_id = parsed.evidence_id || input.evidenceId
parsed.extractions = parsed.extractions || []
parsed.extraction_metadata = parsed.extraction_metadata || {
  total_extractions: parsed.extractions?.length || 0,
  by_domain: {},
  low_confidence_count: 0,
  processing_notes: "Auto-generated",
}
```

---

## Root Cause #4: Connection Timeouts (7% of failures)

**Symptom:**

```
Marked as failed: stuck in running state for 477 minutes
```

**Cause:**
The agent runner has a timeout:

```typescript
const AGENT_TIMEOUT_MS = parseInt(process.env.AGENT_TIMEOUT_MS || "300000") // 5 minutes
```

But this doesn't account for database records getting stuck in "running" state if the process crashes. There's a cleanup mechanism, but it only runs periodically.

**Fix:**

1. Reduce timeout to 2 minutes (most completions take <100s)
2. Add health check that marks old "running" records as failed
3. Add request cancellation on timeout

---

## Recommended Fixes (Priority Order)

### 1. HIGH: Add Rate Limiting to Batch Processing

```typescript
// src/lib/regulatory-truth/agents/extractor.ts

export async function runExtractorBatch(limit: number = 20): Promise<...> {
  // ... existing code ...

  for (const evidence of unprocessedEvidence) {
    // ADD: Pre-emptive rate limiting
    await new Promise(resolve => setTimeout(resolve, 5000))

    try {
      const result = await runExtractor(evidence.id)
      // ... rest of loop
    }
  }
}
```

### 2. HIGH: Improve JSON Extraction

```typescript
// src/lib/regulatory-truth/agents/runner.ts

// After line 154 (getting rawContent)
// Remove any text before the first {
const jsonStartIndex = rawContent.indexOf("{")
if (jsonStartIndex > 0) {
  console.log(`[runner] Stripped ${jsonStartIndex} chars of preamble text`)
  rawContent = rawContent.slice(jsonStartIndex)
}
```

### 3. MEDIUM: Make Schema More Forgiving

```typescript
// src/lib/regulatory-truth/schemas/extractor.ts

export const ExtractorOutputSchema = z.object({
  evidence_id: z.string().optional(), // Make optional
  extractions: z.array(ExtractionItemSchema).default([]), // Default empty
  extraction_metadata: z
    .object({
      total_extractions: z.number().int().min(0).default(0),
      by_domain: z.record(z.string(), z.number()).default({}),
      low_confidence_count: z.number().int().min(0).default(0),
      processing_notes: z.string().default(""),
    })
    .optional(), // Make optional
})
```

### 4. LOW: Add Request Queuing

Consider using a job queue (Bull, BullMQ) to:

- Limit concurrent requests to 1-2
- Handle retries with exponential backoff
- Provide visibility into queue status

---

## Test After Fixes

After implementing fixes, run:

```bash
# Test single extraction
npx tsx -e "
import { runExtractor } from './src/lib/regulatory-truth/agents';
import { db } from './src/lib/db';

async function test() {
  const evidence = await db.evidence.findFirst();
  if (evidence) {
    console.log('Testing extraction for:', evidence.url);
    const result = await runExtractor(evidence.id);
    console.log('Result:', JSON.stringify(result, null, 2));
  }
}
test();
"
```

---

## Expected Improvement

| Error Type         | Before       | After (Expected)              |
| ------------------ | ------------ | ----------------------------- |
| 429 Rate Limiting  | 61           | 0 (with 5s delay)             |
| No JSON Found      | 6            | 1-2 (with preamble stripping) |
| Invalid Schema     | 2            | 0 (with optional fields)      |
| Timeout            | 5            | 1-2 (with shorter timeout)    |
| **Total Failures** | **74 (88%)** | **~5 (6%)**                   |

---

_Analysis by Claude (Opus 4.5) on 2025-12-22_
