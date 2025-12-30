import type {
  EmploymentSnapshot,
  PayrollCalculationInput,
  PayrollCalculationResult,
  PayrollRulesEngineSnapshot,
} from "./types"

export type PayrollRulesEngine = {
  evaluate: (input: PayrollCalculationInput) => {
    result: PayrollCalculationResult
    snapshot: PayrollRulesEngineSnapshot
  }
}

export type PayrollCalculationEnvelope = {
  employmentSnapshot: EmploymentSnapshot
  rulesEngineSnapshot: PayrollRulesEngineSnapshot
  inputSnapshot: PayrollCalculationInput
  outputSnapshot: PayrollCalculationResult
}

export function runPayrollCalculation(
  rulesEngine: PayrollRulesEngine,
  input: PayrollCalculationInput
): PayrollCalculationEnvelope {
  const { result, snapshot } = rulesEngine.evaluate(input)

  return {
    employmentSnapshot: input.employment,
    rulesEngineSnapshot: snapshot,
    inputSnapshot: input,
    outputSnapshot: result,
  }
}
