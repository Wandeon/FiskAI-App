export function shouldFailRegistryCheck({
  harvesterErrors,
  enforcement,
  failOnWarn,
}: {
  harvesterErrors: { path: string; message: string; recoverable: boolean }[]
  enforcement: { passed: boolean; failures: unknown[]; warnings: unknown[] }
  failOnWarn: boolean
}) {
  if (harvesterErrors.length > 0) return true
  if (failOnWarn) return !enforcement.passed || enforcement.warnings.length > 0
  return !enforcement.passed
}
