export {
  encryptSecretEnvelope,
  decryptSecretEnvelope,
  hasSecretEnvelope,
  VaultError,
  type EncryptedEnvelope,
} from "./vault"

export {
  parseEInvoiceSecrets,
  parseFiscalizationSecrets,
  extractP12FromSecrets,
  validateIntegrationKind,
  isEInvoiceKind,
  isFiscalizationKind,
  IntegrationSecretsError,
  type EInvoiceSecrets,
  type FiscalizationSecrets,
  type EInvoiceProviderConfig,
  type FiscalizationProviderConfig,
  type IntegrationKind,
  type IntegrationEnv,
  type IntegrationStatus,
} from "./types"

export {
  createIntegrationAccount,
  findIntegrationAccount,
  findIntegrationAccountById,
  updateIntegrationAccountSecrets,
  disableIntegrationAccount,
  touchIntegrationAccount,
  type CreateIntegrationAccountInput,
  type IntegrationAccountWithSecrets,
} from "./repository"

export {
  IntegrationRequiredError,
  assertLegacyPathAllowed,
  assertWorkerHasIntegration,
  isEnforcementActive,
  isShadowModeActive,
  getEnforcementMode,
  type EnforcedOperation,
  type EnforcementLogContext,
} from "./enforcement"
