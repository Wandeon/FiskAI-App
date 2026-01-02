import { PrismaClient } from "@prisma/client"
import { PrismaInvoiceRepository } from "../invoicing/PrismaInvoiceRepository"

export interface TenantIdentity {
  companyId: string
  userId: string
  correlationId: string
}

export class TenantScopedContext {
  constructor(
    private readonly identity: TenantIdentity,
    private readonly _prisma: PrismaClient
  ) {}

  get companyId(): string {
    return this.identity.companyId
  }

  get userId(): string {
    return this.identity.userId
  }

  get correlationId(): string {
    return this.identity.correlationId
  }

  get prisma(): PrismaClient {
    return this._prisma
  }

  /**
   * Factory method for tenant-scoped invoice repository.
   * All operations are automatically scoped to this context's companyId.
   */
  invoices(): PrismaInvoiceRepository {
    return new PrismaInvoiceRepository(this)
  }
}
