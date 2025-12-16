/**
 * Bank XML Parser for Croatian Banks
 * Supports: camt.053 (ISO 20022), and bank-specific formats
 */

export interface BankTransaction {
  id: string
  date: Date
  amount: number // positive = credit (income), negative = debit (expense)
  currency: string
  description: string
  counterpartyName?: string
  counterpartyIBAN?: string
  reference?: string
  isIncome: boolean
}

export interface ParsedBankStatement {
  bankName: string
  accountIBAN: string
  accountOwner: string
  statementDate: Date
  periodStart: Date
  periodEnd: Date
  openingBalance: number
  closingBalance: number
  transactions: BankTransaction[]
  currency: string
}

export type BankFormat = "camt053" | "erste" | "pbz" | "zaba" | "rba" | "otp" | "unknown"

/**
 * Detect bank format from XML content
 */
export function detectBankFormat(xmlContent: string): BankFormat {
  // Check for camt.053 namespace (ISO 20022)
  if (xmlContent.includes("urn:iso:std:iso:20022:tech:xsd:camt.053")) {
    return "camt053"
  }

  // Bank-specific detection
  if (xmlContent.includes("ErsteBank") || xmlContent.includes("erste")) {
    return "erste"
  }
  if (xmlContent.includes("PBZ") || xmlContent.includes("Privredna banka")) {
    return "pbz"
  }
  if (xmlContent.includes("ZABA") || xmlContent.includes("Zagrebačka banka")) {
    return "zaba"
  }
  if (xmlContent.includes("RBA") || xmlContent.includes("Raiffeisen")) {
    return "rba"
  }
  if (xmlContent.includes("OTP") || xmlContent.includes("OTP banka")) {
    return "otp"
  }

  return "unknown"
}

/**
 * Parse camt.053 (ISO 20022) format - most common
 */
function parseCamt053(xmlContent: string): ParsedBankStatement {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, "text/xml")

  // Check for parsing errors
  const parserError = doc.querySelector("parsererror")
  if (parserError) {
    throw new Error("Neispravan XML format: " + parserError.textContent)
  }

  // Helper to get text content safely
  const getText = (parent: Element | Document, selector: string): string => {
    const el = parent.querySelector(selector)
    return el?.textContent?.trim() || ""
  }

  // Get statement info
  const stmt = doc.querySelector("Stmt") || doc.querySelector("BkToCstmrStmt Stmt")
  if (!stmt) {
    throw new Error("Nije pronađen izvod u XML-u")
  }

  // Account info
  const accountIBAN = getText(stmt, "Acct Id IBAN") || getText(stmt, "Acct Id Othr Id")
  const accountOwner = getText(stmt, "Acct Ownr Nm")
  const currency = getText(stmt, "Acct Ccy") || "EUR"

  // Statement dates
  const creationDate = getText(doc, "CreDtTm") || getText(doc, "GrpHdr CreDtTm")
  const frDt = getText(stmt, "FrToDt FrDtTm") || getText(stmt, "FrToDt Fr DtTm")
  const toDt = getText(stmt, "FrToDt ToDtTm") || getText(stmt, "FrToDt To DtTm")

  // Balances
  const balances = stmt.querySelectorAll("Bal")
  let openingBalance = 0
  let closingBalance = 0

  balances.forEach((bal) => {
    const type = getText(bal, "Tp CdOrPrtry Cd")
    const amount = parseFloat(getText(bal, "Amt") || "0")
    const cdtDbt = getText(bal, "CdtDbtInd")
    const signedAmount = cdtDbt === "DBIT" ? -amount : amount

    if (type === "OPBD" || type === "PRCD") {
      openingBalance = signedAmount
    } else if (type === "CLBD" || type === "CLAV") {
      closingBalance = signedAmount
    }
  })

  // Parse transactions
  const transactions: BankTransaction[] = []
  const entries = stmt.querySelectorAll("Ntry")

  entries.forEach((entry, index) => {
    const amount = parseFloat(getText(entry, "Amt") || "0")
    const cdtDbt = getText(entry, "CdtDbtInd")
    const isCredit = cdtDbt === "CRDT"
    const signedAmount = isCredit ? amount : -amount

    const bookingDate = getText(entry, "BookgDt Dt") || getText(entry, "BookgDt DtTm")
    const valueDate = getText(entry, "ValDt Dt") || getText(entry, "ValDt DtTm")

    // Transaction details
    const txDtls = entry.querySelector("NtryDtls TxDtls")
    const description =
      getText(entry, "AddtlNtryInf") ||
      getText(txDtls || entry, "RmtInf Ustrd") ||
      getText(entry, "NtryDtls Btch PmtInfId") ||
      "Bez opisa"

    const counterpartyName =
      getText(txDtls || entry, "RltdPties Cdtr Nm") ||
      getText(txDtls || entry, "RltdPties Dbtr Nm") ||
      ""

    const counterpartyIBAN =
      getText(txDtls || entry, "RltdPties CdtrAcct Id IBAN") ||
      getText(txDtls || entry, "RltdPties DbtrAcct Id IBAN") ||
      ""

    const reference =
      getText(txDtls || entry, "Refs EndToEndId") || getText(txDtls || entry, "Refs TxId") || ""

    transactions.push({
      id: `tx-${index}-${Date.now()}`,
      date: new Date(bookingDate || valueDate || creationDate),
      amount: signedAmount,
      currency,
      description,
      counterpartyName,
      counterpartyIBAN,
      reference,
      isIncome: isCredit,
    })
  })

  return {
    bankName: detectBankNameFromIBAN(accountIBAN),
    accountIBAN,
    accountOwner,
    statementDate: new Date(creationDate),
    periodStart: new Date(frDt || creationDate),
    periodEnd: new Date(toDt || creationDate),
    openingBalance,
    closingBalance,
    transactions,
    currency,
  }
}

/**
 * Detect bank name from IBAN
 */
function detectBankNameFromIBAN(iban: string): string {
  if (!iban || iban.length < 10) return "Nepoznata banka"

  const bankCode = iban.substring(4, 11) // Croatian IBAN: HR + 2 check + 7 bank code

  const bankCodes: Record<string, string> = {
    "2340009": "Privredna banka Zagreb (PBZ)",
    "2360000": "Zagrebačka banka (ZABA)",
    "2402006": "Erste & Steiermärkische Bank",
    "2484008": "Raiffeisenbank Austria (RBA)",
    "2407000": "OTP banka",
    "2500009": "Addiko Bank",
    "2390001": "Hrvatska poštanska banka (HPB)",
  }

  return bankCodes[bankCode] || "Nepoznata banka"
}

/**
 * Main parser function - detects format and parses accordingly
 */
export function parseBankXML(xmlContent: string): ParsedBankStatement {
  const format = detectBankFormat(xmlContent)

  switch (format) {
    case "camt053":
    case "erste":
    case "zaba":
    case "rba":
    case "otp":
      // Most Croatian banks use camt.053 or similar structure
      return parseCamt053(xmlContent)

    case "pbz":
      // PBZ might have slightly different format, but try camt.053 first
      try {
        return parseCamt053(xmlContent)
      } catch {
        throw new Error("PBZ format nije podržan. Pokušajte izvesti kao camt.053.")
      }

    case "unknown":
    default:
      // Try camt.053 as fallback
      try {
        return parseCamt053(xmlContent)
      } catch {
        throw new Error(
          "Nepoznat format bankovnog izvoda. Podržani formati: camt.053 (ISO 20022), Erste, PBZ, ZABA, RBA, OTP."
        )
      }
  }
}

/**
 * Filter transactions for PO-SD (only income)
 */
export function filterIncomeTransactions(transactions: BankTransaction[]): BankTransaction[] {
  return transactions.filter((tx) => tx.isIncome && tx.amount > 0)
}

/**
 * Group transactions by quarter
 */
export function groupByQuarter(transactions: BankTransaction[]): Record<string, BankTransaction[]> {
  const quarters: Record<string, BankTransaction[]> = {
    Q1: [],
    Q2: [],
    Q3: [],
    Q4: [],
  }

  transactions.forEach((tx) => {
    const month = tx.date.getMonth()
    if (month < 3) quarters.Q1.push(tx)
    else if (month < 6) quarters.Q2.push(tx)
    else if (month < 9) quarters.Q3.push(tx)
    else quarters.Q4.push(tx)
  })

  return quarters
}

/**
 * Calculate totals by quarter
 */
export function calculateQuarterlyTotals(transactions: BankTransaction[]): Record<string, number> {
  const grouped = groupByQuarter(transactions)

  return {
    Q1: grouped.Q1.reduce((sum, tx) => sum + tx.amount, 0),
    Q2: grouped.Q2.reduce((sum, tx) => sum + tx.amount, 0),
    Q3: grouped.Q3.reduce((sum, tx) => sum + tx.amount, 0),
    Q4: grouped.Q4.reduce((sum, tx) => sum + tx.amount, 0),
  }
}
