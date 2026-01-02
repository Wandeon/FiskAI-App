export class TenantScopeMismatchError extends Error {
  constructor(
    public readonly expectedCompanyId: string,
    public readonly actualCompanyId: string,
    public readonly aggregateType: string,
    public readonly aggregateId: string,
    public readonly operation: string
  ) {
    super(
      `Tenant scope violation: ${operation} on ${aggregateType}(${aggregateId}) ` +
        `expected company ${expectedCompanyId}, got ${actualCompanyId}`
    )
    this.name = "TenantScopeMismatchError"
  }
}
