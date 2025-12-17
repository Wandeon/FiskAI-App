// src/lib/fiscal-data/utils/get-value.ts

import { CONTRIBUTIONS } from "../data/contributions"
import { TAX_RATES } from "../data/tax-rates"
import { THRESHOLDS, ADDITIONAL_THRESHOLDS } from "../data/thresholds"
import { DEADLINES, ADDITIONAL_DEADLINES } from "../data/deadlines"
import { PAYMENT_DETAILS } from "../data/payment-details"
import { CHAMBER_FEES, HGK_FEES } from "../data/chamber-fees"

/**
 * All fiscal data objects for path-based access
 */
const FISCAL_DATA = {
  CONTRIBUTIONS,
  TAX_RATES,
  THRESHOLDS,
  ADDITIONAL_THRESHOLDS,
  DEADLINES,
  ADDITIONAL_DEADLINES,
  PAYMENT_DETAILS,
  CHAMBER_FEES,
  HGK_FEES,
} as const

type FiscalDataRoot = keyof typeof FISCAL_DATA

/**
 * Get a fiscal value by dot-notation path
 *
 * @example
 * getValueByPath('CONTRIBUTIONS.rates.MIO_I.rate') // 0.15
 * getValueByPath('THRESHOLDS.pdv.value') // 60000
 * getValueByPath('TAX_RATES.income.brackets.0.rate') // 0.20
 */
export function getValueByPath(path: string): unknown {
  const parts = path.split(".")
  const rootKey = parts[0] as FiscalDataRoot

  if (!(rootKey in FISCAL_DATA)) {
    console.warn(`[fiscal-data] Unknown root: ${rootKey}`)
    return undefined
  }

  let current: unknown = FISCAL_DATA[rootKey]

  for (let i = 1; i < parts.length; i++) {
    if (current === null || current === undefined) {
      console.warn(
        `[fiscal-data] Path not found: ${path} (failed at ${parts.slice(0, i).join(".")})`
      )
      return undefined
    }

    const key = parts[i]

    if (typeof current === "object") {
      // Handle array indices
      if (Array.isArray(current)) {
        const index = parseInt(key, 10)
        if (isNaN(index)) {
          console.warn(`[fiscal-data] Invalid array index: ${key} in path ${path}`)
          return undefined
        }
        current = current[index]
      } else {
        current = (current as Record<string, unknown>)[key]
      }
    } else {
      console.warn(`[fiscal-data] Cannot traverse non-object at ${parts.slice(0, i).join(".")}`)
      return undefined
    }
  }

  return current
}

/**
 * Set a fiscal value by dot-notation path (for updates during validation)
 * Returns a new object with the updated value (immutable)
 *
 * @example
 * const updated = setValueByPath(CONTRIBUTIONS, 'rates.MIO_I.rate', 0.155)
 */
export function setValueByPath<T extends object>(obj: T, path: string, value: unknown): T {
  const parts = path.split(".")
  const result = JSON.parse(JSON.stringify(obj)) as T

  let current: Record<string, unknown> = result as Record<string, unknown>

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]

    if (!(key in current)) {
      current[key] = {}
    }

    current = current[key] as Record<string, unknown>
  }

  const lastKey = parts[parts.length - 1]
  current[lastKey] = value

  return result
}

/**
 * Check if a path exists in fiscal data
 */
export function hasPath(path: string): boolean {
  return getValueByPath(path) !== undefined
}

/**
 * Get all paths for a given root (for validation)
 */
export function getAllPaths(rootKey: FiscalDataRoot): string[] {
  const paths: string[] = []

  function traverse(obj: unknown, currentPath: string) {
    if (obj === null || obj === undefined) return

    if (typeof obj === "object" && !Array.isArray(obj)) {
      for (const key of Object.keys(obj)) {
        const newPath = currentPath ? `${currentPath}.${key}` : key
        const value = (obj as Record<string, unknown>)[key]

        if (typeof value === "number" || typeof value === "string") {
          paths.push(`${rootKey}.${newPath}`)
        } else {
          traverse(value, newPath)
        }
      }
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        traverse(item, `${currentPath}.${index}`)
      })
    }
  }

  traverse(FISCAL_DATA[rootKey], "")
  return paths
}

/**
 * Get a typed value with fallback
 */
export function getTypedValue<T>(path: string, fallback: T): T {
  const value = getValueByPath(path)
  return (value as T) ?? fallback
}

/**
 * Get numeric value with validation
 */
export function getNumericValue(path: string, fallback: number = 0): number {
  const value = getValueByPath(path)
  if (typeof value === "number" && !isNaN(value)) {
    return value
  }
  console.warn(`[fiscal-data] Expected number at ${path}, got ${typeof value}`)
  return fallback
}

/**
 * Get string value with validation
 */
export function getStringValue(path: string, fallback: string = ""): string {
  const value = getValueByPath(path)
  if (typeof value === "string") {
    return value
  }
  console.warn(`[fiscal-data] Expected string at ${path}, got ${typeof value}`)
  return fallback
}
