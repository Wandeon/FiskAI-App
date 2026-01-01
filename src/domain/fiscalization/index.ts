// src/domain/fiscalization/index.ts
export { FiscalError } from "./FiscalError"
export {
  FiscalStatus,
  canTransitionFiscal,
  isTerminalFiscal,
  getValidFiscalTransitions,
} from "./FiscalStatus"
export { FiscalRequest, type FiscalRequestProps } from "./FiscalRequest"
export { type FiscalRequestRepository } from "./FiscalRequestRepository"
export { buildZkiString, type ZkiInput } from "./ZkiCalculator"
export {
  shouldFiscalize,
  getFiscalizationSkipReason,
  PaymentMethod,
  type FiscalizationContext,
} from "./ShouldFiscalize"
