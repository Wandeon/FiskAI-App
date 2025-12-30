# Issue #675: Implementation Plan - 11-Year Retention Policy

## Problem Summary

Croatian tax law requires 11-year document retention, but:
1. R2 storage has no lifecycle management
2. No automated archival to cold storage
3. No protection against accidental deletion
4. Local file storage (banking imports) has no retention enforcement

## Solution Overview

Implement tiered retention strategy:
1. **Metadata tagging** - Track retention requirements
2. **Object Lock** - Prevent premature deletion (optional but recommended)
3. **Lifecycle rules** - Transition to cold storage
4. **Migrate local storage** - Move banking imports to R2

## Implementation Checklist

### ✅ Phase 1: Core Infrastructure (Completed)

- [x] Add Object Lock imports to R2 client
- [x] Update `uploadToR2()` to accept retention options
- [x] Add metadata tagging for all uploads
- [x] Implement Object Lock support (with graceful degradation)
- [x] Create comprehensive documentation

### 🔄 Phase 2: Apply to Upload Routes (In Progress)

**File: `src/app/api/import/upload/route.ts`**
- [ ] Update uploadToR2 call to include retention:
```typescript
await uploadToR2(key, buffer, file.type, {
  retentionYears: 11,
  metadata: {
    'company-id': company.id,
    'original-filename': fileName,
    'document-type': documentType || 'UNKNOWN',
  },
})
```

**File: `src/app/api/banking/import/upload/route.ts`**
- [ ] Migrate from local filesystem to R2
- [ ] Add R2 client imports
- [ ] Replace `fs.writeFile()` with `uploadToR2()`
- [ ] Update cleanup logic to use `deleteFromR2()`
- [ ] Change `storagePath` to `storageKey` in database

### ⏳ Phase 3: Environment Configuration

- [ ] Document R2_OBJECT_LOCK_ENABLED requirement
- [ ] Add to `.env.example`
- [ ] Update Coolify deployment guide
- [ ] Create bucket setup instructions

### ⏳ Phase 4: Testing & Validation

- [ ] Test metadata tagging on new uploads
- [ ] Verify Object Lock prevents deletion
- [ ] Test backward compatibility (existing storagePath records)
- [ ] Banking import end-to-end test

### ⏳ Phase 5: Migration (Optional)

- [ ] Create script to migrate existing local files to R2
- [ ] Update ImportJob records (storagePath → storageKey)
- [ ] Clean up orphaned local files

## Code Changes Required

### 1. `src/lib/r2-client.ts` ✅

```typescript
// Add imports
import {
  PutObjectRetentionCommand,
  ObjectLockRetentionMode,
} from "@aws-sdk/client-s3"

// Update uploadToR2 signature
export async function uploadToR2(
  key: string,
  data: Buffer,
  contentType: string,
  options?: {
    retentionYears?: number
    metadata?: Record<string, string>
  }
): Promise<string> {
  // Implementation with metadata and Object Lock
}
```

### 2. `src/app/api/import/upload/route.ts`

```typescript
// Before detecting document type, add:
const detection = detectDocumentType(fileName, file.type)
const documentType = (documentTypeOverride as DocumentType | null) || detection.type

// Then upload with retention:
const key = generateR2Key(company.id, checksum, fileName)
await uploadToR2(key, buffer, file.type, {
  retentionYears: 11, // Croatian tax law requirement
  metadata: {
    'company-id': company.id,
    'original-filename': fileName,
    'document-type': documentType || 'UNKNOWN',
  },
})
```

### 3. `src/app/api/banking/import/upload/route.ts`

```typescript
// Replace filesystem operations:
import { uploadToR2, generateR2Key, deleteFromR2 } from "@/lib/r2-client"

// Remove:
// - import fs from "fs"
// - import path from "path"
// - storageDir creation
// - fs.writeFile()

// Add R2 upload:
const key = generateR2Key(company.id, checksum, fileName)
await uploadToR2(key, buffer, file.type, {
  retentionYears: 11,
  metadata: {
    'company-id': company.id,
    'bank-account-id': accountId,
    'original-filename': fileName,
    'document-type': 'BANK_STATEMENT',
  },
})

// Update ImportJob.create:
data: {
  // ...
  storageKey: key, // instead of storagePath
  // ...
}

// Update cleanup on overwrite:
if (existingJob.storageKey) {
  await deleteFromR2(existingJob.storageKey)
}
```

## Environment Variables

Add to production environment:

```bash
# Enable Object Lock retention enforcement
R2_OBJECT_LOCK_ENABLED=true
```

## R2 Bucket Setup

**For new buckets:**
```bash
wrangler r2 bucket create fiskai-documents --object-lock
```

**Configure lifecycle rules** (via Cloudflare Dashboard or API):
- Transition to Infrequent Access after 1 year
- Transition to Glacier after 2 years
- Keep until 11 years (retention policy)

## Testing Scenarios

1. **Upload with retention**
   - Upload document
   - Verify metadata includes `retention-years: "11"`
   - Check Object Lock (if enabled)

2. **Attempt early deletion**
   - Try to delete file before 11 years
   - Should fail with AccessDenied (if Object Lock enabled)

3. **Banking import migration**
   - Upload bank statement
   - Verify stored in R2 (not local)
   - Check storageKey populated in database

4. **Overwrite flow**
   - Upload duplicate
   - Confirm overwrite prompt
   - Verify old file deleted from R2

## Rollback Plan

If issues arise:
1. Set `R2_OBJECT_LOCK_ENABLED=false` to disable Object Lock
2. Metadata tagging remains active (no-op if removed)
3. Banking imports: Keep both storagePath and storageKey for transition period

## Success Criteria

- ✅ All new uploads tagged with 11-year retention metadata
- ✅ Object Lock prevents deletion (when enabled)
- ✅ Banking imports use R2 instead of local filesystem
- ✅ Documentation complete for operations team
- ✅ No breaking changes to existing functionality

## Timeline Estimate

- Core infrastructure: ✅ Complete
- Apply to routes: 2-3 hours (includes testing)
- Environment setup: 30 minutes
- Testing: 1-2 hours
- **Total remaining**: ~4-6 hours

## References

- Issue #675
- `/docs/STORAGE_RETENTION_POLICY.md` - Full documentation
- `/src/lib/archive/archive-manager.ts` - Existing retention logic
