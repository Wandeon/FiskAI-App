export enum FiscalStatus {
  NOT_REQUIRED = "NOT_REQUIRED",
  PENDING = "PENDING",
  SUBMITTING = "SUBMITTING",
  FISCALIZED = "FISCALIZED",
  FAILED = "FAILED",
  RETRY_SCHEDULED = "RETRY_SCHEDULED",
  DEADLINE_EXCEEDED = "DEADLINE_EXCEEDED",
}

const VALID_TRANSITIONS: Record<FiscalStatus, FiscalStatus[]> = {
  [FiscalStatus.NOT_REQUIRED]: [],
  [FiscalStatus.PENDING]: [FiscalStatus.SUBMITTING, FiscalStatus.FAILED],
  [FiscalStatus.SUBMITTING]: [FiscalStatus.FISCALIZED, FiscalStatus.FAILED],
  [FiscalStatus.FAILED]: [FiscalStatus.RETRY_SCHEDULED, FiscalStatus.DEADLINE_EXCEEDED],
  [FiscalStatus.RETRY_SCHEDULED]: [FiscalStatus.SUBMITTING],
  [FiscalStatus.FISCALIZED]: [],
  [FiscalStatus.DEADLINE_EXCEEDED]: [],
}

export function canTransitionFiscal(from: FiscalStatus, to: FiscalStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

export function isTerminalFiscal(status: FiscalStatus): boolean {
  return [
    FiscalStatus.NOT_REQUIRED,
    FiscalStatus.FISCALIZED,
    FiscalStatus.DEADLINE_EXCEEDED,
  ].includes(status)
}

export function getValidFiscalTransitions(status: FiscalStatus): FiscalStatus[] {
  return [...VALID_TRANSITIONS[status]]
}
