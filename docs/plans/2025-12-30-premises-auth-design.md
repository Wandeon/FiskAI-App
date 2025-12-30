# Premises Auth Hardening Design

**Goal:** Prevent unauthenticated and cross-tenant access to premises/device actions while keeping current UX unchanged.

**Context:** `src/app/actions/premises.ts` and `src/lib/premises/bulk-actions.ts` perform writes without auth/tenant checks. The Prisma tenant extension does not scope `updateMany`, `count`, or `delete`, so relying on global tenant context alone is insufficient for these paths.

## Approach

1. **Authentication + tenant context**
   - Wrap each server action with `requireAuth()` and `requireCompanyWithContext()`.
   - Always use the company from context rather than trusting `input.companyId`.
   - Keep role gating unchanged (no new RBAC permissions) to minimize behavior changes.

2. **Explicit company scoping for non-intercepted operations**
   - Add `companyId` filters to `updateMany`, `count`, and `deleteMany` calls.
   - Replace `delete` with `deleteMany` where needed to enforce tenant scope and handle not-found safely.

3. **Ownership checks for foreign keys**
   - Validate that `businessPremisesId` belongs to the current company before creating devices or assigning in bulk.

## Data Flow

- Client submits action -> action calls `requireAuth` -> `requireCompanyWithContext` -> DB operations scoped with `company.id` -> return success/error.
- `revalidatePath` calls remain unchanged.

## Error Handling

- Preserve existing user-facing error strings.
- Return not-found errors when attempting to act on non-owned records.

## Testing

- Add Vitest unit tests that fail on current behavior and pass after changes:
  - `createPremises` uses context company ID (ignores `input.companyId`).
  - `createDevice` rejects when the premises is not in the current company.
  - `bulkTogglePremisesStatus` scopes `updateMany` by `companyId`.
