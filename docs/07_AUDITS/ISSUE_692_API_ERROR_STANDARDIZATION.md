# Issue #692: Standardized API Error Response Migration

**Status:** Implemented
**Created:** 2025-12-30
**Issue:** [#692 - Inconsistent 500 Error Response Format](https://github.com/wandeon/FiskAI/issues/692)

## Problem

API routes return 500 errors in inconsistent formats, creating security risks and debugging challenges:

1. **Security Risk:** Some routes expose raw `error.message` which may leak:
   - Internal error details to clients
   - Stack traces or internal paths
   - Prisma/database errors revealing schema

2. **Debugging Impact:**
   - No consistent error code for client handling
   - Missing correlation ID in responses
   - Inconsistent error formats across 20+ API routes

## Solution

Created a standardized `apiError()` utility at `/src/lib/api-error.ts` that:

- ✅ Logs full error details server-side (with pino's automatic redaction)
- ✅ Returns safe, generic message to client for 5xx errors
- ✅ Includes request ID for support correlation (from AsyncLocalStorage context)
- ✅ Prevents sensitive data leakage
- ✅ Provides consistent error code format

## Migration Pattern

### Before (Insecure)

```typescript
// ❌ INSECURE: Exposes error.message to client
try {
  await someOperation()
} catch (error) {
  console.error("Error executing action:", error)
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Internal server error" },
    { status: 500 }
  )
}
```

### After (Secure)

```typescript
// ✅ SECURE: Logs full error, returns generic message
import { apiError } from "@/lib/api-error"

try {
  await someOperation()
} catch (error) {
  return apiError(error)
  // Server logs: full error with stack trace, request ID, user/company context
  // Client gets: { "error": "Internal server error", "code": "INTERNAL_ERROR", "requestId": "..." }
}
```

## Usage Examples

### Pattern 1: Generic 500 errors

```typescript
import { apiError } from "@/lib/api-error"

export async function POST(request: Request) {
  try {
    // ... API logic
  } catch (error) {
    return apiError(error)
  }
}
```

### Pattern 2: 401/403 errors

```typescript
import { ApiErrors } from "@/lib/api-error"

if (!user || user.systemRole !== "ADMIN") {
  return ApiErrors.forbidden("ADMIN role required")
}
```

### Pattern 3: Custom error with context

```typescript
import { apiError } from "@/lib/api-error"

try {
  await processInvoice(id)
} catch (error) {
  return apiError(error, {
    code: "INVOICE_PROCESSING_FAILED",
    message: "Neuspjelo procesiranje računa",
    logContext: { invoiceId: id },
  })
}
```

## Response Format

Client receives:

```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR",
  "requestId": "uuid-here"
}
```

Server logs include:

- Full error object with stack trace
- Request ID
- User ID and Company ID (from context)
- Any additional logContext provided

## Security Benefits

1. **No Information Disclosure:** Generic messages prevent leaking:
   - Database schema (Prisma errors)
   - Internal file paths (stack traces)
   - Sensitive business logic details

2. **Consistent Error Codes:** Clients can handle errors programmatically

3. **Request Correlation:** Support can trace issues using `requestId`

4. **Automatic Redaction:** Pino logger redacts sensitive fields (passwords, tokens, etc.)

## Migration Instructions

### Automated Migration

Run the migration script:

```bash
./scripts/migrate-api-error-responses.sh --dry-run  # Preview changes
./scripts/migrate-api-error-responses.sh            # Apply changes
```

### Manual Migration

For each API route file:

1. Add import:

```typescript
import { apiError, ApiErrors } from "@/lib/api-error"
```

2. Replace catch blocks:

```typescript
// Before
} catch (error) {
  return NextResponse.json({ error: "..." }, { status: 500 })
}

// After
} catch (error) {
  return apiError(error)
}
```

3. Replace auth errors:

```typescript
// Before
return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

// After
return ApiErrors.unauthorized()
```

## Related Files

- `/src/lib/api-error.ts` - Core utility
- `/src/lib/logger.ts` - Logger with automatic redaction
- `/src/lib/context.ts` - AsyncLocalStorage for request context
- `/src/lib/api-logging.ts` - API middleware that sets up context
- `/scripts/migrate-api-error-responses.sh` - Automated migration script

## References

- GitHub Issue: [#692](https://github.com/wandeon/FiskAI/issues/692)
- Pull Request: #TBD
