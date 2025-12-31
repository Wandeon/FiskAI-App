/**
 * E-Invoice Status Transition Validator
 *
 * Centralized validation of invoice status transitions to ensure
 * regulatory compliance and prevent invalid state changes.
 *
 * Fixes: GitHub Issue #698
 */

import { EInvoiceStatus } from "@prisma/client"

const VALID_TRANSITIONS: Record<EInvoiceStatus, EInvoiceStatus[]> = {
  DRAFT: ["PENDING_FISCALIZATION", "SENT", "ERROR"],
  PENDING_FISCALIZATION: ["FISCALIZED", "ERROR"],
  FISCALIZED: ["SENT", "ARCHIVED"],
  SENT: ["DELIVERED", "ACCEPTED", "REJECTED", "ERROR"],
  DELIVERED: ["ACCEPTED", "REJECTED", "ARCHIVED"],
  ACCEPTED: ["ARCHIVED"],
  REJECTED: ["ARCHIVED"],
  ARCHIVED: [],
  ERROR: ["DRAFT", "PENDING_FISCALIZATION"],
}

export function validateStatusTransition(from: EInvoiceStatus, to: EInvoiceStatus): boolean {
  if (from === to) return true
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

export function getTransitionError(from: EInvoiceStatus, to: EInvoiceStatus): string {
  const statusNames: Record<EInvoiceStatus, string> = {
    DRAFT: "Nacrt",
    PENDING_FISCALIZATION: "Čeka fiskalizaciju",
    FISCALIZED: "Fiskaliziran",
    SENT: "Poslan",
    DELIVERED: "Dostavljen",
    ACCEPTED: "Prihvaćen",
    REJECTED: "Odbijen",
    ARCHIVED: "Arhiviran",
    ERROR: "Greška",
  }

  if (from === "ARCHIVED")
    return `Nije moguće promijeniti status arhiviranog računa. Status: ${statusNames[from]}`
  if (from === "FISCALIZED" && to === "DRAFT")
    return "Nije moguće vratiti fiskalizirani račun u nacrt. Koristite storno račun umjesto toga."
  if (from === "DRAFT" && to === "ACCEPTED")
    return "Račun mora biti fiskaliziran prije prihvaćanja."

  return `Neispravan prijelaz statusa: ${statusNames[from]} → ${statusNames[to]}. Provjerite životni ciklus računa.`
}

export function getAllowedTransitions(from: EInvoiceStatus): EInvoiceStatus[] {
  return VALID_TRANSITIONS[from] ?? []
}

export function isTerminalStatus(status: EInvoiceStatus): boolean {
  return VALID_TRANSITIONS[status]?.length === 0
}

export function assertValidTransition(from: EInvoiceStatus, to: EInvoiceStatus): void {
  if (!validateStatusTransition(from, to)) {
    throw new Error(getTransitionError(from, to))
  }
}
