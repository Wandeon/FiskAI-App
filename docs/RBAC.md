# Role-Based Access Control (RBAC) System

## Overview

The RBAC system enforces permission checking across the application to ensure users can only perform actions they are authorized for based on their role within a company.

## Roles

The system supports five roles, defined in the Prisma schema:

- **OWNER**: Full control over the company, including billing and user role management
- **ADMIN**: Can manage most resources and invite/remove users, but cannot change billing or user roles
- **MEMBER**: Can create, read, and update resources, but cannot delete them
- **ACCOUNTANT**: Can read all financial data and export reports, but has limited write access
- **VIEWER**: Read-only access to most resources

## Permission Matrix

### Invoices

- **invoice:create**: OWNER, ADMIN, MEMBER
- **invoice:read**: OWNER, ADMIN, MEMBER, ACCOUNTANT, VIEWER
- **invoice:update**: OWNER, ADMIN, MEMBER
- **invoice:delete**: OWNER, ADMIN

### Expenses

- **expense:create**: OWNER, ADMIN, MEMBER
- **expense:read**: OWNER, ADMIN, MEMBER, ACCOUNTANT, VIEWER
- **expense:update**: OWNER, ADMIN, MEMBER
- **expense:delete**: OWNER, ADMIN

### Contacts

- **contact:create**: OWNER, ADMIN, MEMBER
- **contact:read**: OWNER, ADMIN, MEMBER, ACCOUNTANT, VIEWER
- **contact:update**: OWNER, ADMIN, MEMBER
- **contact:delete**: OWNER, ADMIN

### Products

- **product:create**: OWNER, ADMIN, MEMBER
- **product:read**: OWNER, ADMIN, MEMBER, ACCOUNTANT, VIEWER
- **product:update**: OWNER, ADMIN, MEMBER
- **product:delete**: OWNER, ADMIN

### Settings & Management

- **settings:read**: OWNER, ADMIN, ACCOUNTANT
- **settings:update**: OWNER, ADMIN
- **billing:manage**: OWNER only
- **users:invite**: OWNER, ADMIN
- **users:remove**: OWNER, ADMIN
- **users:update_role**: OWNER only

### Reports

- **reports:read**: OWNER, ADMIN, ACCOUNTANT, VIEWER
- **reports:export**: OWNER, ADMIN, ACCOUNTANT

## Usage in Server Actions

### Basic Pattern

For actions that require permission checking, use `requireCompanyWithPermission`:

```typescript
import { requireAuth, requireCompanyWithPermission } from "@/lib/auth-utils"

export async function deleteInvoice(id: string) {
  try {
    const user = await requireAuth()

    return requireCompanyWithPermission(user.id!, "invoice:delete", async (company, user) => {
      // User has permission, proceed with deletion
      const invoice = await db.eInvoice.findFirst({ where: { id } })

      if (!invoice) {
        return { success: false, error: "Invoice not found" }
      }

      await db.eInvoice.delete({ where: { id } })
      revalidatePath("/invoices")

      return { success: true }
    })
  } catch (error) {
    console.error("Failed to delete invoice:", error)

    // Handle permission errors
    if (error instanceof Error && error.message.includes("Permission denied")) {
      return { success: false, error: "You do not have permission to delete invoices" }
    }

    return { success: false, error: "Failed to delete invoice" }
  }
}
```

### For Actions Without Permission Requirements

If an action doesn't require specific permissions (e.g., listing resources that all users can read), use `requireCompanyWithContext`:

```typescript
import { requireAuth, requireCompanyWithContext } from "@/lib/auth-utils"

export async function getInvoices() {
  const user = await requireAuth()

  return requireCompanyWithContext(user.id!, async (company, user) => {
    const invoices = await db.eInvoice.findMany()
    return { success: true, data: invoices }
  })
}
```

## Helper Functions

### `hasPermission(userId, companyId, permission)`

Checks if a user has a specific permission. Returns a boolean.

```typescript
import { hasPermission } from "@/lib/rbac"

const canDelete = await hasPermission(userId, companyId, "invoice:delete")
if (canDelete) {
  // Show delete button
}
```

### `requirePermission(userId, companyId, permission)`

Throws an error if the user doesn't have permission. Useful when you need to check permissions in the middle of an operation.

```typescript
import { requirePermission } from "@/lib/rbac"

await requirePermission(userId, companyId, "invoice:delete")
// Will throw if user doesn't have permission
```

### `roleHasPermission(role, permission)`

Check if a role has permission without a database lookup. Useful for UI rendering.

```typescript
import { roleHasPermission } from '@/lib/rbac'

// In a React component where you already have the user's role
if (roleHasPermission(userRole, 'invoice:delete')) {
  return <DeleteButton />
}
```

### `getUserRole(userId, companyId)`

Get the user's role for a specific company.

```typescript
import { getUserRole } from "@/lib/rbac"

const role = await getUserRole(userId, companyId)
console.log("User role:", role)
```

## Extending the Permission System

To add new permissions:

1. Add the permission to the `PERMISSIONS` object in `/home/admin/FiskAI/src/lib/rbac.ts`:

```typescript
export const PERMISSIONS = {
  // ... existing permissions ...

  // New feature permissions
  "analytics:read": ["OWNER", "ADMIN", "ACCOUNTANT"],
  "analytics:export": ["OWNER", "ADMIN"],
} as const
```

2. Use the new permission in your server actions:

```typescript
return requireCompanyWithPermission(user.id!, "analytics:export", async () => {
  // Export analytics
})
```

## Migration Guide

To migrate existing server actions to use RBAC:

1. Import `requireCompanyWithPermission`:

   ```typescript
   import { requireCompanyWithPermission } from "@/lib/auth-utils"
   ```

2. Replace `requireCompanyWithContext` with `requireCompanyWithPermission` for sensitive operations:

   ```typescript
   // Before
   return requireCompanyWithContext(user.id!, async () => {
     await db.eInvoice.delete({ where: { id } })
   })

   // After
   return requireCompanyWithPermission(user.id!, "invoice:delete", async () => {
     await db.eInvoice.delete({ where: { id } })
   })
   ```

3. Add permission error handling:
   ```typescript
   catch (error) {
     if (error instanceof Error && error.message.includes('Permission denied')) {
       return { success: false, error: 'You do not have permission' }
     }
     // ... other error handling
   }
   ```

## Testing

Tests are available in `/home/admin/FiskAI/src/lib/__tests__/rbac.test.ts` to verify permission logic.

## Security Considerations

1. **Always check permissions on the server side**: Never rely on client-side permission checks alone
2. **Use the most restrictive permission**: If unsure, start with fewer roles and add more as needed
3. **Tenant isolation**: All permission checks work in conjunction with tenant isolation to ensure users can only access data from their company
4. **Audit logging**: Consider adding audit logs for sensitive operations (deletions, role changes, etc.)

## Examples

See the following files for implementation examples:

- `/home/admin/FiskAI/src/app/actions/invoice.ts` - Invoice delete action
- `/home/admin/FiskAI/src/app/actions/expense.ts` - Expense delete action
