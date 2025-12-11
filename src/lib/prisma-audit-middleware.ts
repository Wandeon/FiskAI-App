// Entities to audit - add more as needed
const AUDITED_MODELS = [
  'EInvoice',
  'Contact',
  'Product',
  'Company',
  'EInvoiceLine',
];

// Map Prisma actions to our AuditAction enum
const ACTION_MAP: Record<string, 'CREATE' | 'UPDATE' | 'DELETE'> = {
  create: 'CREATE',
  update: 'UPDATE',
  delete: 'DELETE',
  createMany: 'CREATE',
  updateMany: 'UPDATE',
  deleteMany: 'DELETE',
  upsert: 'UPDATE',
};

interface AuditQueueItem {
  companyId: string;
  userId: string | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  entityId: string;
  changes: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null;
}

// Prisma middleware types for v7+
type MiddlewareParams = {
  model?: string;
  action: string;
  args: unknown;
  dataPath: string[];
  runInTransaction: boolean;
};

type MiddlewareNext = (params: MiddlewareParams) => Promise<unknown>;

// Queue for batch processing - avoid circular import issues
const auditQueue: AuditQueueItem[] = [];
let isProcessing = false;

async function processAuditQueue() {
  if (isProcessing || auditQueue.length === 0) return;
  isProcessing = true;

  try {
    // Dynamic import to avoid circular dependency
    const { db } = await import('./db');

    while (auditQueue.length > 0) {
      const item = auditQueue.shift();
      if (!item) continue;

      try {
        await db.auditLog.create({
          data: {
            companyId: item.companyId,
            userId: item.userId,
            action: item.action,
            entity: item.entity,
            entityId: item.entityId,
            changes: item.changes ?? undefined,
          },
        });
      } catch (error) {
        console.error('[AuditMiddleware] Failed to create audit log:', error);
      }
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Prisma middleware that automatically logs CREATE, UPDATE, DELETE operations
 * for specified models. Uses a queue to avoid blocking the main operation.
 */
export const auditMiddleware = async (params: MiddlewareParams, next: MiddlewareNext) => {
  // Skip if not an audited model or action
  if (!params.model || !AUDITED_MODELS.includes(params.model)) {
    return next(params);
  }

  const action = ACTION_MAP[params.action];
  if (!action) {
    return next(params);
  }

  // Execute the operation first
  const result = await next(params);

  // Skip if no result (e.g., deleteMany with no matches)
  if (!result) {
    return result;
  }

  // Extract company ID and entity ID from the result or args
  let companyId: string | null = null;
  let entityId: string | null = null;
  let changes: { before?: Record<string, unknown>; after?: Record<string, unknown> } | null = null;

  // Handle different result types
  if (Array.isArray(result)) {
    // Batch operations - log each item
    for (const item of result) {
      if (typeof item === 'object' && item !== null) {
        companyId = (item as Record<string, unknown>).companyId as string;
        entityId = (item as Record<string, unknown>).id as string;
        if (companyId && entityId) {
          auditQueue.push({
            companyId,
            userId: null, // Middleware doesn't have user context
            action,
            entity: params.model,
            entityId,
            changes: action === 'CREATE' ? { after: item as Record<string, unknown> } : null,
          });
        }
      }
    }
  } else if (typeof result === 'object' && result !== null) {
    companyId = (result as Record<string, unknown>).companyId as string;
    entityId = (result as Record<string, unknown>).id as string;

    if (action === 'CREATE') {
      changes = { after: result as Record<string, unknown> };
    } else if (action === 'UPDATE') {
      // For updates, we only capture the "after" state here
      // The "before" state would require an extra query which is expensive
      changes = { after: result as Record<string, unknown> };
    }

    if (companyId && entityId) {
      // Try to get user context from AsyncLocalStorage if not provided
      let userId: string | null = null;

      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { getContext } = require('./context');
        const ctx = getContext();
        if (ctx?.userId) userId = ctx.userId;
      } catch (e) {
        // Ignore import errors or context errors
      }

      auditQueue.push({
        companyId,
        userId,
        action,
        entity: params.model,
        entityId,
        changes,
      });
    }

    // Process queue asynchronously (fire and forget)
    processAuditQueue().catch(console.error);

    return result;
  };
