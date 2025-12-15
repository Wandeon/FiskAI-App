# Multi-Tenant Isolation Tests

This directory contains comprehensive tests for the multi-tenant isolation system in FiskAI.

## Overview

The tenant isolation system ensures that data is properly segregated between different companies (tenants) in the system. This is critical for data security and privacy in a multi-tenant SaaS application.

## Test Files

### `tenant-isolation.test.ts`

Comprehensive test suite covering all aspects of tenant isolation:

1. **Context Management Tests** (5 tests)
   - Test `setTenantContext()` and `getTenantContext()` functions
   - Test `runWithTenant()` properly isolates tenant context
   - Test concurrent context isolation
   - Test context updates within runWithTenant
   - Test context doesn't leak outside runWithTenant

2. **Prisma Middleware - Query Filtering Tests** (4 tests)
   - Test automatic `companyId` filter on `findMany`
   - Test automatic `companyId` filter on `findFirst`
   - Test `findUnique` verifies `companyId` after fetch
   - Test cross-tenant access returns null

3. **Prisma Middleware - Create Operations Tests** (2 tests)
   - Test automatic `companyId` injection on `create`
   - Test automatic `companyId` injection on `createMany`

4. **Prisma Middleware - Update Operations Tests** (2 tests)
   - Test automatic `companyId` filter on `update`
   - Test automatic `companyId` filter on `updateMany`

5. **Prisma Middleware - Delete Operations Tests** (2 tests)
   - Test automatic `companyId` filter on `delete`
   - Test automatic `companyId` filter on `deleteMany`

6. **Prisma Middleware - Aggregate Operations Tests** (3 tests)
   - Test automatic `companyId` filter on `count`
   - Test automatic `companyId` filter on `aggregate`
   - Test automatic `companyId` filter on `groupBy`

7. **Prisma Middleware - Upsert Operations Tests** (1 test)
   - Test automatic `companyId` injection and filtering on `upsert`

8. **Security Scenario Tests** (7 tests)
   - Test User A cannot read User B's invoices (different tenants)
   - Test bulk operations respect tenant isolation
   - Test missing tenant context is handled gracefully
   - Test cross-tenant updates are prevented
   - Test cross-tenant deletes are prevented
   - Test aggregate operations are isolated
   - Test nested async operations maintain isolation

9. **Edge Case Tests** (3 tests)
   - Test operations on non-tenant-scoped models work correctly
   - Test existing where clauses are preserved when adding companyId
   - Test empty data in createMany is handled

**Total: 29 tests across 10 test suites**

### `rbac.test.ts`

Tests for Role-Based Access Control (RBAC) permissions system.

## Running the Tests

### Run All Tests

```bash
npm test
```

### Run Only Tenant Isolation Tests

```bash
npm run test:tenant
```

### Run Tests in Watch Mode

The tests use Node.js's built-in test runner with `tsx` for TypeScript support. Currently, watch mode is not configured, but you can manually re-run tests after changes.

## Test Framework

- **Test Runner**: Node.js built-in test runner (`node:test`)
- **TypeScript Execution**: `tsx` (fast TypeScript execution)
- **Assertion Library**: Node.js built-in `assert` module
- **Mocking Strategy**: Custom mock Prisma client

## Mock Implementation

The tests use a custom `MockPrismaClient` that simulates Prisma's extension API. This allows testing the middleware logic without a real database connection.

Key features of the mock:
- Implements Prisma's `$extends()` API
- Supports all CRUD operations: findMany, findFirst, findUnique, create, update, delete, etc.
- Supports bulk operations: createMany, updateMany, deleteMany
- Supports aggregate operations: count, aggregate, groupBy
- Simulates audit log creation without errors
- Returns realistic mock data based on operation type

## Architecture Tested

The tests validate the multi-tenant isolation architecture defined in `/home/admin/FiskAI/src/lib/prisma-extensions.ts`:

### AsyncLocalStorage for Context

- Uses Node.js `AsyncLocalStorage` for thread-safe tenant context
- Context is automatically isolated per request/async operation
- No risk of context leaking between concurrent requests

### Tenant-Scoped Models

The following models are automatically filtered by `companyId`:
- Contact
- Product
- EInvoice
- EInvoiceLine
- AuditLog
- BankAccount
- BankTransaction
- BankImport
- ImportJob
- Statement
- StatementPage
- Transaction
- Expense
- ExpenseCategory
- RecurringExpense
- SavedReport
- SupportTicket
- SupportTicketMessage
- BusinessPremises
- PaymentDevice
- InvoiceSequence
- CompanyUser

### Middleware Operations Covered

All Prisma operations are intercepted and secured:
- **Read**: findMany, findFirst, findUnique
- **Write**: create, update, delete
- **Bulk**: createMany, updateMany, deleteMany
- **Aggregate**: count, aggregate, groupBy
- **Special**: upsert

## Security Guarantees Tested

1. **Cross-Tenant Isolation**: Users in Company A cannot access Company B's data
2. **Automatic Filtering**: All queries are automatically filtered by companyId
3. **Create Safety**: All creates automatically include the tenant's companyId
4. **Context Isolation**: Concurrent requests maintain separate contexts
5. **No Context Leaks**: Context doesn't persist outside of runWithTenant
6. **Bulk Operation Safety**: Bulk operations respect tenant boundaries

## Test Results

All 29 tests pass successfully:

```
# tests 29
# suites 10
# pass 29
# fail 0
```

## Adding New Tests

When adding new tenant-scoped models or operations:

1. Add the model name to the `models` array in `MockPrismaClient`
2. Add corresponding tests in the appropriate test suite
3. Ensure the model is in the `TENANT_MODELS` array in `prisma-extensions.ts`
4. Test all CRUD operations for the new model
5. Add security scenario tests if the model contains sensitive data

## Continuous Integration

To integrate these tests into CI/CD:

```yaml
# Example GitHub Actions workflow
- name: Run Tests
  run: npm test

- name: Run Tenant Isolation Tests
  run: npm run test:tenant
```

## Related Files

- `/home/admin/FiskAI/src/lib/prisma-extensions.ts` - Main tenant isolation implementation
- `/home/admin/FiskAI/src/lib/db.ts` - Database client with tenant isolation applied
- `/home/admin/FiskAI/src/lib/context.ts` - Request context management

## Troubleshooting

### Tests Fail to Import Modules

Ensure `tsx` is installed:
```bash
npm install --save-dev tsx --legacy-peer-deps
```

### Type Errors

Ensure TypeScript and types are up to date:
```bash
npm install --save-dev @types/node typescript
```

### Mock Doesn't Match Real Behavior

Update the `mockDbQuery` function in `tenant-isolation.test.ts` to match the expected Prisma behavior.

## Future Enhancements

Potential improvements to the test suite:

1. **Integration Tests**: Add tests that use a real test database
2. **Performance Tests**: Measure overhead of tenant isolation middleware
3. **Stress Tests**: Test with many concurrent tenant contexts
4. **Migration Tests**: Ensure database migrations maintain tenant isolation
5. **Audit Log Tests**: Verify audit logs respect tenant boundaries
6. **Error Scenarios**: Test behavior with invalid companyIds
7. **Race Condition Tests**: More extensive concurrent access tests
