import type { ContactType } from "@prisma/client"

export interface ContactListParams {
  search?: string
  type?: ContactType | "ALL"
  segments?: ContactSegment[]
  page?: number
  limit?: number
}

export type ContactSegment = "VAT_PAYER" | "MISSING_EMAIL" | "NO_DOCUMENTS"
