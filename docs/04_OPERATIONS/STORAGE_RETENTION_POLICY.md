# Storage Retention Policy - 11-Year Croatian Compliance

## Overview

FiskAI implements an 11-year document retention policy in compliance with Croatian tax law requirements (Opći porezni zakon).

## Implementation

### R2 Storage with Retention

All document uploads now include:
- **Retention metadata**: `retention-years: "11"`
- **Upload timestamp**: `uploaded-at: ISO 8601`
- **Object Lock** (optional): COMPLIANCE mode preventing deletion before retention period expires

### Files Updated

1. `src/lib/r2-client.ts`
   - Added `PutObjectRetentionCommand` support
   - Updated `uploadToR2()` to accept `retentionYears` and `metadata` options
   - Applies Object Lock when `R2_OBJECT_LOCK_ENABLED=true`

2. `src/app/api/import/upload/route.ts`
   - Uploads with 11-year retention metadata

3. `src/app/api/banking/import/upload/route.ts`
   - (Planned) Migrate from local storage to R2 with retention

## Configuration

### Environment Variables

```bash
R2_OBJECT_LOCK_ENABLED=true  # Enable Object Lock enforcement
```

### R2 Bucket Setup

Bucket must be created with Object Lock enabled:

```bash
wrangler r2 bucket create fiskai-documents --object-lock
```

**Note**: Object Lock cannot be enabled on existing buckets. Must be set at creation time.

### Recommended Lifecycle Rules

For cost optimization, configure tiered storage:

- **0-1 year**: Standard storage
- **1-2 years**: Infrequent Access
- **2-11 years**: Glacier (cold storage)

## Compliance Verification

To verify retention enforcement:

```typescript
// Check file metadata
const metadata = await r2Client.send(new HeadObjectCommand({ Bucket, Key }))
console.log(metadata.Metadata?.['retention-years']) // "11"

// Check Object Lock
const retention = await r2Client.send(new GetObjectRetentionCommand({ Bucket, Key }))
console.log(retention.Retention?.RetainUntilDate) // Date 11 years from upload
```

## Deployment Checklist

- [ ] Create R2 bucket with `--object-lock` flag
- [ ] Set `R2_OBJECT_LOCK_ENABLED=true` in environment
- [ ] Deploy updated r2-client code
- [ ] Test upload and verify metadata
- [ ] Attempt deletion to verify Object Lock works

## References

- Issue #675
- `/docs/plans/ISSUE-675-RETENTION-IMPLEMENTATION.md`
- Croatian General Tax Act (Opći porezni zakon)
