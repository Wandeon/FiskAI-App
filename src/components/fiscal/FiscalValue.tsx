// src/components/fiscal/FiscalValue.tsx
"use client"

import { getValueByPath, formatFiscalValue, getEffectiveValue } from "@/lib/fiscal-data"
import type { FormatType } from "@/lib/fiscal-data"
import { cn } from "@/lib/utils"

interface FiscalValueProps {
  /** Path to the fiscal value (e.g., "THRESHOLDS.pdv.value") */
  path: string
  /** Format type for display */
  format?: FormatType
  /** Number of decimal places */
  decimals?: number
  /** Whether to show the unit (EUR, %, etc.) */
  showUnit?: boolean
  /** Custom CSS class */
  className?: string
  /** Fallback value if path not found */
  fallback?: string
}

/**
 * FiscalValue Component
 *
 * Displays fiscal values from the central data source.
 * Use this in MDX content to show auto-updating values.
 *
 * @example
 * <FiscalValue path="THRESHOLDS.pdv.value" format="currency" />
 * // Renders: "60.000,00 EUR"
 *
 * <FiscalValue path="CONTRIBUTIONS.rates.MIO_I.rate" format="percentage" />
 * // Renders: "15%"
 */
export function FiscalValue({
  path,
  format = "number",
  decimals,
  showUnit = true,
  className,
  fallback = "—",
}: FiscalValueProps) {
  const rawValue = getValueByPath(path)

  if (rawValue === undefined || rawValue === null) {
    console.warn(`[FiscalValue] Path not found: ${path}`)
    return <span className={cn("text-danger", className)}>{fallback}</span>
  }

  // Handle objects with value property (like ThresholdValue)
  let value: number | string =
    typeof rawValue === "object" && rawValue !== null && "value" in rawValue
      ? (rawValue as { value: number | string }).value
      : (rawValue as number | string)

  // Check for effective date handling
  if (typeof rawValue === "object" && rawValue !== null && "effectiveFrom" in rawValue) {
    value = getEffectiveValue(
      rawValue as { value: number; effectiveFrom?: string; previousValue?: number }
    )
  }

  const formatted = formatFiscalValue(value, format, { decimals, showUnit })

  return (
    <span
      className={cn("font-mono text-accent-light", className)}
      data-fiscal-path={path}
      title={`Izvor: ${path}`}
    >
      {formatted}
    </span>
  )
}

/**
 * FiscalCurrency - Shorthand for currency values
 */
export function FiscalCurrency({
  path,
  decimals = 2,
  className,
  ...props
}: Omit<FiscalValueProps, "format">) {
  return (
    <FiscalValue
      path={path}
      format="currency"
      decimals={decimals}
      className={className}
      {...props}
    />
  )
}

/**
 * FiscalPercentage - Shorthand for percentage values
 */
export function FiscalPercentage({
  path,
  decimals = 0,
  className,
  ...props
}: Omit<FiscalValueProps, "format">) {
  return (
    <FiscalValue
      path={path}
      format="percentage"
      decimals={decimals}
      className={className}
      {...props}
    />
  )
}

/**
 * LastVerified Badge
 * Shows when the fiscal data was last verified
 */
export function LastVerified({ className }: { className?: string }) {
  const lastVerified = getValueByPath("CONTRIBUTIONS.lastVerified") as string

  if (!lastVerified) return null

  const date = new Date(lastVerified)
  const formatted = date.toLocaleDateString("hr-HR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-success-bg0/10 px-3 py-1 text-xs font-medium text-success",
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      Podaci verificirani: {formatted}
    </span>
  )
}

/**
 * FiscalTable - Auto-generate comparison tables from fiscal data
 */
interface FiscalTableProps {
  paths: Array<{
    path: string
    label: string
    format?: FormatType
  }>
  className?: string
}

export function FiscalTable({ paths, className }: FiscalTableProps) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-white/10", className)}>
      <table className="min-w-full">
        <tbody>
          {paths.map(({ path, label, format }) => (
            <tr key={path} className="border-b border-white/10 last:border-b-0">
              <td className="px-4 py-3 text-sm text-white/70">{label}</td>
              <td className="px-4 py-3 text-right">
                <FiscalValue path={path} format={format} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
