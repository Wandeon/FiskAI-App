// src/infrastructure/banking/CsvParser.ts
import { Money } from "@/domain/shared"
import { TransactionDirection } from "@/domain/banking"

/**
 * Supported bank CSV formats
 */
export type BankFormat = "erste" | "pbz" | "zaba" | "generic"

/**
 * Parsed row from a bank CSV statement
 */
export interface ParsedRow {
  date: Date
  amount: Money
  direction: TransactionDirection
  reference?: string
  counterpartyName?: string
  counterpartyIban?: string
  description?: string
  balance?: Money
  externalId?: string
}

/**
 * Raw CSV row as key-value pairs
 */
export type RawRow = Record<string, string>

/**
 * Parsing error with context
 */
export class CsvParseError extends Error {
  readonly code = "CSV_PARSE_ERROR"

  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: string
  ) {
    super(message)
    this.name = "CsvParseError"
  }
}

/**
 * Parse Croatian-formatted amount string to Money.
 * Handles format: -1.234,56 or 1.234,56
 * - Thousands separator: . (dot)
 * - Decimal separator: , (comma)
 *
 * @param value - Croatian formatted amount string
 * @param currency - Currency code (default: EUR)
 * @returns Money instance
 * @throws CsvParseError if value cannot be parsed
 */
export function parseCroatianAmount(value: string, currency = "EUR"): Money {
  if (!value || typeof value !== "string") {
    throw new CsvParseError("Amount value is required", "amount", value)
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new CsvParseError("Amount value cannot be empty", "amount", value)
  }

  // Remove thousands separators (dots) and convert decimal comma to dot
  // Croatian format: 1.234,56 -> 1234.56
  const normalized = trimmed
    .replace(/\./g, "") // Remove thousands separators
    .replace(",", ".") // Convert decimal comma to dot

  // Validate the normalized format
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    throw new CsvParseError(`Invalid amount format: "${value}"`, "amount", value)
  }

  return Money.fromString(normalized, currency)
}

/**
 * Parse Croatian-formatted date string to Date.
 * Handles format: DD.MM.YYYY
 *
 * @param value - Croatian formatted date string
 * @returns Date instance
 * @throws CsvParseError if value cannot be parsed
 */
export function parseCroatianDate(value: string): Date {
  if (!value || typeof value !== "string") {
    throw new CsvParseError("Date value is required", "date", value)
  }

  const trimmed = value.trim()
  if (!trimmed) {
    throw new CsvParseError("Date value cannot be empty", "date", value)
  }

  // Match DD.MM.YYYY format
  const match = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
  if (!match) {
    throw new CsvParseError(`Invalid date format: "${value}" (expected DD.MM.YYYY)`, "date", value)
  }

  const [, dayStr, monthStr, yearStr] = match
  const day = parseInt(dayStr, 10)
  const month = parseInt(monthStr, 10) - 1 // JS months are 0-indexed
  const year = parseInt(yearStr, 10)

  // Validate ranges
  if (month < 0 || month > 11) {
    throw new CsvParseError(`Invalid month: ${month + 1}`, "date", value)
  }
  if (day < 1 || day > 31) {
    throw new CsvParseError(`Invalid day: ${day}`, "date", value)
  }
  if (year < 1900 || year > 2100) {
    throw new CsvParseError(`Invalid year: ${year}`, "date", value)
  }

  const date = new Date(year, month, day)

  // Check if date is valid (e.g., Feb 30 would become March)
  if (date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
    throw new CsvParseError(`Invalid date: "${value}"`, "date", value)
  }

  return date
}

/**
 * Determine transaction direction from amount sign and optional indicator.
 * Positive amounts are credits (money in), negative are debits (money out).
 *
 * @param amount - The parsed Money amount
 * @param indicator - Optional direction indicator (D/C, debit/credit, etc.)
 * @returns TransactionDirection
 */
export function determineDirection(amount: Money, indicator?: string): TransactionDirection {
  // If indicator is provided, use it
  if (indicator) {
    const normalized = indicator.trim().toUpperCase()
    if (normalized === "D" || normalized === "DEBIT" || normalized === "DUGUJE") {
      return TransactionDirection.DEBIT
    }
    if (normalized === "C" || normalized === "CREDIT" || normalized === "POTRAZUJE") {
      return TransactionDirection.CREDIT
    }
  }

  // Fall back to amount sign
  return amount.isNegative() ? TransactionDirection.DEBIT : TransactionDirection.CREDIT
}

/**
 * Parse Erste Bank CSV row.
 *
 * Expected columns:
 * - Datum knjizenja (booking date)
 * - Iznos (amount)
 * - Stanje (balance)
 * - Naziv primatelja/platitelja (counterparty name)
 * - IBAN primatelja/platitelja (counterparty IBAN)
 * - Poziv na broj (reference)
 * - Opis placanja (description)
 */
export function parseErsteRow(row: RawRow): ParsedRow {
  const dateValue =
    row["Datum knjizenja"] || row["Datum valute"] || row["Datum"] || row["datum knjizenja"]
  const amountValue = row["Iznos"] || row["iznos"]
  const balanceValue = row["Stanje"] || row["stanje"]
  const counterpartyName =
    row["Naziv primatelja/platitelja"] || row["Naziv"] || row["naziv primatelja/platitelja"]
  const counterpartyIban =
    row["IBAN primatelja/platitelja"] || row["IBAN"] || row["iban primatelja/platitelja"]
  const reference = row["Poziv na broj"] || row["Model i poziv na broj"] || row["poziv na broj"]
  const description = row["Opis placanja"] || row["Opis"] || row["opis placanja"]
  const externalId = row["ID transakcije"] || row["Broj transakcije"] || row["id transakcije"]

  if (!dateValue) {
    throw new CsvParseError("Missing date column", "Datum knjizenja")
  }
  if (!amountValue) {
    throw new CsvParseError("Missing amount column", "Iznos")
  }

  const amount = parseCroatianAmount(amountValue)
  const direction = determineDirection(amount)

  // Amount should always be positive; direction indicates flow
  const absoluteAmount = amount.isNegative() ? amount.multiply(-1) : amount

  const result: ParsedRow = {
    date: parseCroatianDate(dateValue),
    amount: absoluteAmount,
    direction,
  }

  if (balanceValue) {
    result.balance = parseCroatianAmount(balanceValue)
  }
  if (counterpartyName?.trim()) {
    result.counterpartyName = counterpartyName.trim()
  }
  if (counterpartyIban?.trim()) {
    result.counterpartyIban = counterpartyIban.trim()
  }
  if (reference?.trim()) {
    result.reference = reference.trim()
  }
  if (description?.trim()) {
    result.description = description.trim()
  }
  if (externalId?.trim()) {
    result.externalId = externalId.trim()
  }

  return result
}

/**
 * Parse PBZ Bank CSV row.
 *
 * Expected columns:
 * - Datum (date)
 * - Iznos (amount)
 * - Stanje (balance)
 * - Primatelj/Platitelj (counterparty name)
 * - IBAN (counterparty IBAN)
 * - Poziv na broj (reference)
 * - Opis (description)
 */
export function parsePbzRow(row: RawRow): ParsedRow {
  const dateValue = row["Datum"] || row["datum"] || row["Datum valute"]
  const amountValue = row["Iznos"] || row["iznos"] || row["Promet"]
  const balanceValue = row["Stanje"] || row["stanje"] || row["Novo stanje"]
  const counterpartyName = row["Primatelj/Platitelj"] || row["Naziv"] || row["primatelj/platitelj"]
  const counterpartyIban = row["IBAN"] || row["iban"] || row["Racun"]
  const reference = row["Poziv na broj"] || row["poziv na broj"] || row["Referenca"]
  const description = row["Opis"] || row["opis"] || row["Opis prometa"]
  const externalId = row["ID"] || row["id"] || row["Broj dokumenta"]

  if (!dateValue) {
    throw new CsvParseError("Missing date column", "Datum")
  }
  if (!amountValue) {
    throw new CsvParseError("Missing amount column", "Iznos")
  }

  const amount = parseCroatianAmount(amountValue)
  const direction = determineDirection(amount)
  const absoluteAmount = amount.isNegative() ? amount.multiply(-1) : amount

  const result: ParsedRow = {
    date: parseCroatianDate(dateValue),
    amount: absoluteAmount,
    direction,
  }

  if (balanceValue) {
    result.balance = parseCroatianAmount(balanceValue)
  }
  if (counterpartyName?.trim()) {
    result.counterpartyName = counterpartyName.trim()
  }
  if (counterpartyIban?.trim()) {
    result.counterpartyIban = counterpartyIban.trim()
  }
  if (reference?.trim()) {
    result.reference = reference.trim()
  }
  if (description?.trim()) {
    result.description = description.trim()
  }
  if (externalId?.trim()) {
    result.externalId = externalId.trim()
  }

  return result
}

/**
 * Parse Zagrebacka Banka (ZABA) CSV row.
 *
 * Expected columns:
 * - Datum izvrsenja (execution date)
 * - Iznos (amount)
 * - Saldo (balance)
 * - Naziv (counterparty name)
 * - IBAN racun (counterparty IBAN)
 * - Poziv na broj (reference)
 * - Svrha (description/purpose)
 */
export function parseZabaRow(row: RawRow): ParsedRow {
  const dateValue =
    row["Datum izvrsenja"] || row["Datum"] || row["datum izvrsenja"] || row["Datum valute"]
  const amountValue = row["Iznos"] || row["iznos"] || row["Promet"]
  const balanceValue = row["Saldo"] || row["saldo"] || row["Stanje"]
  const counterpartyName = row["Naziv"] || row["naziv"] || row["Naziv platitelja/primatelja"]
  const counterpartyIban = row["IBAN racun"] || row["IBAN"] || row["iban racun"]
  const reference = row["Poziv na broj"] || row["poziv na broj"]
  const description = row["Svrha"] || row["svrha"] || row["Opis"]
  const externalId = row["Referenca"] || row["referenca"] || row["ID transakcije"]

  if (!dateValue) {
    throw new CsvParseError("Missing date column", "Datum izvrsenja")
  }
  if (!amountValue) {
    throw new CsvParseError("Missing amount column", "Iznos")
  }

  const amount = parseCroatianAmount(amountValue)
  const direction = determineDirection(amount)
  const absoluteAmount = amount.isNegative() ? amount.multiply(-1) : amount

  const result: ParsedRow = {
    date: parseCroatianDate(dateValue),
    amount: absoluteAmount,
    direction,
  }

  if (balanceValue) {
    result.balance = parseCroatianAmount(balanceValue)
  }
  if (counterpartyName?.trim()) {
    result.counterpartyName = counterpartyName.trim()
  }
  if (counterpartyIban?.trim()) {
    result.counterpartyIban = counterpartyIban.trim()
  }
  if (reference?.trim()) {
    result.reference = reference.trim()
  }
  if (description?.trim()) {
    result.description = description.trim()
  }
  if (externalId?.trim()) {
    result.externalId = externalId.trim()
  }

  return result
}

/**
 * Parse generic CSV row with standard column names.
 *
 * Expected columns:
 * - date (DD.MM.YYYY format)
 * - amount (Croatian format)
 * - balance (optional, Croatian format)
 * - counterparty_name (optional)
 * - counterparty_iban (optional)
 * - reference (optional)
 * - description (optional)
 * - external_id (optional)
 * - direction (optional: D/C, debit/credit)
 */
export function parseGenericRow(row: RawRow): ParsedRow {
  const dateValue = row["date"] || row["Date"] || row["DATE"]
  const amountValue = row["amount"] || row["Amount"] || row["AMOUNT"]
  const balanceValue = row["balance"] || row["Balance"] || row["BALANCE"]
  const counterpartyName =
    row["counterparty_name"] || row["counterpartyName"] || row["CounterpartyName"]
  const counterpartyIban =
    row["counterparty_iban"] || row["counterpartyIban"] || row["CounterpartyIban"]
  const reference = row["reference"] || row["Reference"] || row["REFERENCE"]
  const description = row["description"] || row["Description"] || row["DESCRIPTION"]
  const externalId = row["external_id"] || row["externalId"] || row["ExternalId"]
  const directionIndicator = row["direction"] || row["Direction"] || row["DIRECTION"]

  if (!dateValue) {
    throw new CsvParseError("Missing date column", "date")
  }
  if (!amountValue) {
    throw new CsvParseError("Missing amount column", "amount")
  }

  const amount = parseCroatianAmount(amountValue)
  const direction = determineDirection(amount, directionIndicator)
  const absoluteAmount = amount.isNegative() ? amount.multiply(-1) : amount

  const result: ParsedRow = {
    date: parseCroatianDate(dateValue),
    amount: absoluteAmount,
    direction,
  }

  if (balanceValue) {
    result.balance = parseCroatianAmount(balanceValue)
  }
  if (counterpartyName?.trim()) {
    result.counterpartyName = counterpartyName.trim()
  }
  if (counterpartyIban?.trim()) {
    result.counterpartyIban = counterpartyIban.trim()
  }
  if (reference?.trim()) {
    result.reference = reference.trim()
  }
  if (description?.trim()) {
    result.description = description.trim()
  }
  if (externalId?.trim()) {
    result.externalId = externalId.trim()
  }

  return result
}

/**
 * Parse a CSV row using the specified bank format.
 *
 * @param row - Raw CSV row as key-value pairs
 * @param format - Bank format to use for parsing
 * @returns Parsed row with normalized data
 * @throws CsvParseError if row cannot be parsed
 */
export function parseCsvRow(row: RawRow, format: BankFormat): ParsedRow {
  switch (format) {
    case "erste":
      return parseErsteRow(row)
    case "pbz":
      return parsePbzRow(row)
    case "zaba":
      return parseZabaRow(row)
    case "generic":
      return parseGenericRow(row)
    default: {
      // Exhaustive check
      const _exhaustive: never = format
      throw new CsvParseError(`Unknown bank format: ${_exhaustive}`)
    }
  }
}
