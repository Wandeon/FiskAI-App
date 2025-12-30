# Implementation Guide for Issue #768: Feature Flag Soft Delete

This document describes the complete implementation for adding soft-delete functionality to the feature flags system.

## Overview

The current feature flag system performs hard deletes, which is risky. This implementation adds:
- Soft-delete with `DELETED` status and `deletedAt` timestamp
- Required deletion reason with audit trail
- Proper confirmation dialog in Croatian
- Ability to restore deleted flags

## Changes Required

### 1. Prisma Schema (`prisma/schema.prisma`)

#### Add DELETED status to FeatureFlagStatus enum (line ~3201):
```prisma
enum FeatureFlagStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
  DELETED  // <-- ADD THIS
}
```

#### Add soft-delete fields to FeatureFlag model (after line ~3228):
```prisma
  // Audit trail
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime? // Soft-delete timestamp   // <-- ADD THIS
  createdBy String? // User ID who created
  updatedBy String? // User ID who last updated
  deletedBy String? // User ID who soft-deleted  // <-- ADD THIS
```

#### Add deletedAt index to FeatureFlag model (after line ~3239):
```prisma
  @@index([key])
  @@index([status])
  @@index([category])
  @@index([tags])
  @@index([deletedAt])  // <-- ADD THIS
```

#### Add DELETED and RESTORED actions to FeatureFlagAuditAction enum (after line ~3277):
```prisma
enum FeatureFlagAuditAction {
  CREATED
  UPDATED
  ENABLED
  DISABLED
  ARCHIVED
  OVERRIDE_ADDED
  OVERRIDE_REMOVED
  ROLLOUT_CHANGED
  DELETED   // <-- ADD THIS
  RESTORED  // <-- ADD THIS
}
```

### 2. Create Migration

Create file: `prisma/migrations/20251230_add_soft_delete_to_feature_flags/migration.sql`

```sql
-- AlterEnum
ALTER TYPE "FeatureFlagStatus" ADD VALUE 'DELETED';

-- AlterEnum
ALTER TYPE "FeatureFlagAuditAction" ADD VALUE 'DELETED';
ALTER TYPE "FeatureFlagAuditAction" ADD VALUE 'RESTORED';

-- AlterTable
ALTER TABLE "FeatureFlag" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedBy" TEXT;

-- CreateIndex
CREATE INDEX "FeatureFlag_deletedAt_idx" ON "FeatureFlag"("deletedAt");
```

### 3. Service Layer (`src/lib/feature-flags/service.ts`)

#### Update `getAllFlags` function (line ~52):
```typescript
/**
 * Get all feature flags with their overrides (cached)
 * Excludes soft-deleted flags by default
 */
export async function getAllFlags(includeDeleted = false): Promise<FeatureFlagWithOverrides[]> {
  if (isCacheValid() && !includeDeleted) {
    return cache!.flags
  }

  const flags = await prisma.featureFlag.findMany({
    where: includeDeleted ? {} : { status: { not: "DELETED" } },
    include: {
      overrides: true,
    },
    orderBy: { key: "asc" },
  })

  if (!includeDeleted) {
    cache = { flags, timestamp: Date.now() }
  }
  return flags
}
```

#### Replace `deleteFlag` function (line ~355):
```typescript
/**
 * Delete a feature flag (soft delete)
 */
export async function deleteFlag(id: string, userId: string, reason?: string): Promise<void> {
  const previous = await prisma.featureFlag.findUnique({ where: { id } })
  if (!previous) throw new Error("Feature flag not found")

  // Soft delete by setting status to DELETED and recording timestamp
  await prisma.featureFlag.update({
    where: { id },
    data: {
      status: "DELETED",
      deletedAt: new Date(),
      deletedBy: userId,
      updatedBy: userId,
    },
  })

  // Log deletion
  await prisma.featureFlagAuditLog.create({
    data: {
      flagId: id,
      action: "DELETED",
      userId,
      previousValue: previous as unknown as object,
      reason: reason || "Flag soft-deleted",
    },
  })

  invalidateCache()
}

/**
 * Restore a soft-deleted feature flag
 */
export async function restoreFlag(id: string, userId: string, reason?: string): Promise<FeatureFlag> {
  const previous = await prisma.featureFlag.findUnique({ where: { id } })
  if (!previous) throw new Error("Feature flag not found")
  if (previous.status !== "DELETED") throw new Error("Flag is not deleted")

  const flag = await prisma.featureFlag.update({
    where: { id },
    data: {
      status: "INACTIVE", // Restore to inactive state for safety
      deletedAt: null,
      deletedBy: null,
      updatedBy: userId,
    },
  })

  // Log restoration
  await prisma.featureFlagAuditLog.create({
    data: {
      flagId: id,
      action: "RESTORED",
      userId,
      previousValue: previous as unknown as object,
      newValue: flag as unknown as object,
      reason: reason || "Flag restored from deletion",
    },
  })

  invalidateCache()
  return flag
}
```

### 4. API Route (`src/app/api/admin/feature-flags/[id]/route.ts`)

#### Replace DELETE function (line ~64):
```typescript
/**
 * DELETE /api/admin/feature-flags/[id]
 *
 * Soft-delete a feature flag (requires reason)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requireAdmin()
  const { id } = await params

  const flag = await getFlagById(id)
  if (!flag) {
    return NextResponse.json({ error: "Feature flag not found" }, { status: 404 })
  }

  // Extract reason from request body
  const body = await request.json().catch(() => ({}))
  const { reason } = body

  if (!reason || reason.trim().length === 0) {
    return NextResponse.json({ error: "Deletion reason is required" }, { status: 400 })
  }

  await deleteFlag(id, user.id!, reason)
  return NextResponse.json({ success: true })
}
```

### 5. Frontend Component (`src/app/(admin)/feature-flags/feature-flags-view.tsx`)

#### Add state after editingId state (line ~36):
```typescript
const [editingId, setEditingId] = useState<string | null>(null)
const [deleteConfirm, setDeleteConfirm] = useState<{ flag: FeatureFlagWithOverrides; reason: string } | null>(null)  // <-- ADD THIS
```

#### Replace handleDelete function (line ~96):
```typescript
const handleDelete = async (flag: FeatureFlagWithOverrides) => {
  setDeleteConfirm({ flag, reason: "" })
}

const confirmDelete = async () => {
  if (!deleteConfirm) return
  const { flag, reason } = deleteConfirm

  if (!reason || reason.trim().length === 0) {
    alert("Morate navesti razlog brisanja")
    return
  }

  try {
    const res = await fetch(`/api/admin/feature-flags/${flag.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    })

    if (!res.ok) {
      const error = await res.json()
      alert(error.error || "Greška pri brisanju feature flaga")
      return
    }

    setFlags((prev) => prev.filter((f) => f.id !== flag.id))
    setDeleteConfirm(null)
  } catch (error) {
    console.error("Failed to delete flag:", error)
    alert("Greška pri brisanju feature flaga")
  }
}
```

#### Add confirmation modal before closing </div>) tags (before line ~401):
```tsx
      </table>
    </div>

    {/* Delete Confirmation Modal */}
    {deleteConfirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-lg rounded-lg border border-default bg-white p-6 shadow-xl">
          <h3 className="mb-4 text-lg font-semibold text-foreground">
            Potvrdi brisanje feature flaga
          </h3>
          <p className="mb-4 text-sm text-secondary">
            Sigurno želite obrisati feature flag <strong>{deleteConfirm.flag.name}</strong>?
          </p>
          <p className="mb-4 text-sm text-danger-text">
            <strong>Upozorenje:</strong> Flag će biti označen kao obrisan i neće biti vidljiv u listi. Može se vratiti naknadno.
          </p>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-secondary">
              Razlog brisanja <span className="text-danger-text">*</span>
            </label>
            <textarea
              className="w-full rounded-md border border-default bg-white px-3 py-2 text-sm"
              rows={3}
              placeholder="Unesite razlog brisanja (obavezno)"
              value={deleteConfirm.reason}
              onChange={(e) =>
                setDeleteConfirm({ ...deleteConfirm, reason: e.target.value })
              }
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Odustani
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={!deleteConfirm.reason || deleteConfirm.reason.trim().length === 0}
            >
              Obriši
            </Button>
          </div>
        </div>
      </div>
    )}
  </div>
  )
}
```

## Testing Checklist

- [ ] Verify Prisma schema changes are correct
- [ ] Run migration: `npx prisma migrate dev`
- [ ] Test deleting a feature flag (should show Croatian confirmation dialog)
- [ ] Verify deletion reason is required
- [ ] Check that deleted flag disappears from list
- [ ] Verify audit log shows DELETED action with reason
- [ ] Test restoreFlag function in console
- [ ] Verify restored flag appears with INACTIVE status

## Security Improvements

This implementation provides:
1. **Soft-delete**: Flags are never permanently deleted
2. **Audit trail**: All deletions are logged with who/when/why
3. **Required reason**: Prevents accidental deletions
4. **Two-step confirmation**: Modal dialog prevents misclicks
5. **Recovery**: Deleted flags can be restored
6. **Status visibility**: Deleted flags are hidden from normal views

## Croatian UI Text

- **Potvrdi brisanje feature flaga** - Confirm feature flag deletion
- **Sigurno želite obrisati feature flag** - Are you sure you want to delete the feature flag
- **Upozorenje** - Warning
- **Razlog brisanja** - Deletion reason
- **Unesite razlog brisanja (obavezno)** - Enter deletion reason (required)
- **Odustani** - Cancel
- **Obriši** - Delete
- **Morate navesti razlog brisanja** - You must specify a deletion reason
- **Greška pri brisanju feature flaga** - Error deleting feature flag
