// src/domain/invoicing/InvoiceStatus.ts

export enum InvoiceStatus {
  DRAFT = "DRAFT",
  PENDING_FISCALIZATION = "PENDING_FISCALIZATION",
  FISCALIZED = "FISCALIZED",
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  ACCEPTED = "ACCEPTED",
  CANCELED = "CANCELED",
  ARCHIVED = "ARCHIVED",
}

const VALID_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.PENDING_FISCALIZATION, InvoiceStatus.CANCELED],
  [InvoiceStatus.PENDING_FISCALIZATION]: [InvoiceStatus.FISCALIZED, InvoiceStatus.DRAFT],
  [InvoiceStatus.FISCALIZED]: [InvoiceStatus.SENT],
  [InvoiceStatus.SENT]: [InvoiceStatus.DELIVERED, InvoiceStatus.ACCEPTED],
  [InvoiceStatus.DELIVERED]: [InvoiceStatus.ACCEPTED],
  [InvoiceStatus.ACCEPTED]: [InvoiceStatus.ARCHIVED],
  [InvoiceStatus.CANCELED]: [],
  [InvoiceStatus.ARCHIVED]: [],
}

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

export function isTerminal(status: InvoiceStatus): boolean {
  return VALID_TRANSITIONS[status].length === 0
}

export function getValidTransitions(status: InvoiceStatus): InvoiceStatus[] {
  return [...VALID_TRANSITIONS[status]]
}
