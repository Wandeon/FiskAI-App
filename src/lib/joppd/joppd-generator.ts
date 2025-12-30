import { create } from "xmlbuilder2"
import { formatAmount } from "@/lib/fiscal/utils"

export interface JoppdLineField {
  name: string
  value: string
}

export interface JoppdLineInput {
  lineNumber: number
  payoutLineId: string
  ruleVersionId?: string | null
  recipientName?: string | null
  recipientOib?: string | null
  grossAmount?: number | null
  netAmount?: number | null
  taxAmount?: number | null
  originalLineId?: string | null
  lineData?: unknown
}

export interface JoppdFormData {
  submissionId: string
  companyOib: string
  companyName: string
  periodYear: number
  periodMonth: number
  payoutId: string
  payoutDate: Date
  createdAt: Date
  correctionOfSubmissionId?: string | null
  lines: JoppdLineInput[]
}

function getJoppdIdentifier(date: Date): string {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  const day = Math.floor(diff / oneDay)
  const yy = date.getFullYear().toString().slice(-2)
  const ddd = String(day).padStart(3, "0")
  return `${yy}${ddd}`
}

function extractLineDataField(lineData: unknown, key: string, defaultValue: string): string {
  if (lineData && typeof lineData === "object" && !Array.isArray(lineData)) {
    const record = lineData as Record<string, unknown>
    if (key in record) {
      return String(record[key])
    }
  }
  return defaultValue
}

export function generateJoppdXml(data: JoppdFormData): string {
  const identifier = getJoppdIdentifier(data.payoutDate)
  const reportDate = data.createdAt.toISOString().slice(0, 10)

  const doc = create({ version: "1.0", encoding: "UTF-8" }).ele("ObrazacJOPPD", {
    xmlns: "http://e-porezna.porezna-uprava.hr/sheme/zahtjevi/ObrazacJOPPD/v1-1",
    "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
    "xsi:schemaLocation":
      "http://e-porezna.porezna-uprava.hr/sheme/zahtjevi/ObrazacJOPPD/v1-1 ObrazacJOPPD-v1-1.xsd",
    Original: data.correctionOfSubmissionId ? "false" : "true",
  })

  // ============================================
  // METADATA
  // ============================================
  doc
    .ele("Metapodaci")
    .ele("DatumIzvjesca")
    .txt(reportDate)
    .up()
    .ele("OznakaIzvjesca")
    .txt(identifier)
    .up()
    .ele("OznakaPodnositelja")
    .txt("1") // 1 = Obveznik podnosenja
    .up()
    .up()

  // ============================================
  // PAGE A (Strana A) - Aggregates
  // ============================================
  const count = data.lines.length

  // Simple sum logic - in a real app, these should be separate DB fields to ensure accuracy
  const sumGross = data.lines.reduce((s, l) => s + (l.grossAmount || 0), 0)
  const sumNet = data.lines.reduce((s, l) => s + (l.netAmount || 0), 0)
  const sumTax = data.lines.reduce((s, l) => s + (l.taxAmount || 0), 0)

  // Infer contributions as the gap (Gross - Net - Tax)
  // NOTE: This assumes no non-taxable nont-net items.
  const sumContrib = Math.max(0, sumGross - sumNet - sumTax)
  const sumIncome = sumGross - sumContrib // Dohodak = Primitak - Doprinosi

  const stranaA = doc.ele("StranaA")

  const podnositelj = stranaA.ele("PodnositeljIzvjesca")
  podnositelj.ele("OIB").txt(data.companyOib).up()
  podnositelj.ele("Naziv").txt(data.companyName).up()
  podnositelj.ele("Adresa").txt("Adresa nije unesena").up() // Placeholder
  podnositelj.ele("Email").txt("info@fiskai.hr").up() // Placeholder
  podnositelj.up()

  stranaA.ele("BrojOsoba").txt(String(count)).up()
  stranaA.ele("BrojRedaka").txt(String(count)).up()
  stranaA.ele("I").txt(formatAmount(sumGross)).up() // Ukupni iznos primitka
  stranaA.ele("II").txt(formatAmount(sumContrib)).up() // Ukupni iznos doprinosa
  stranaA.ele("III").txt(formatAmount(sumIncome)).up() // Ukupni iznos dohotka
  stranaA.ele("IV").txt(formatAmount(sumTax)).up() // Ukupni porez i prirez
  stranaA.ele("V").txt(formatAmount(sumNet)).up() // Ukupni neto
  stranaA.up()

  // ============================================
  // PAGE B (Strana B) - Line Items
  // ============================================
  const stranaB = doc.ele("StranaB")

  for (const line of data.lines) {
    const gross = line.grossAmount || 0
    const net = line.netAmount || 0
    const tax = line.taxAmount || 0
    const contrib = Math.max(0, gross - net - tax)

    const p = stranaB.ele("P")

    // P1: OIB Stjecatelja
    p.ele("P1")
      .txt(line.recipientOib || "")
      .up()

    // P2: Ime i Prezime
    p.ele("P2")
      .txt(line.recipientName || "")
      .up()

    // P3: Oznaka opcine prebivalista (Default ZG 01333 if missing)
    p.ele("P3")
      .txt(extractLineDataField(line.lineData, "municipalityCode", "01333"))
      .up()

    // P4: Oznaka opcine rada (Default ZG 01333 if missing)
    p.ele("P4")
      .txt(extractLineDataField(line.lineData, "workMunicipalityCode", "01333"))
      .up()

    // P5: Razdoblje obracuna (From - To)
    // Assume current month
    const fromDate = `${data.periodYear}-${String(data.periodMonth).padStart(2, "0")}-01`
    // Last day of month
    const lastDay = new Date(data.periodYear, data.periodMonth, 0).getDate()
    const toDate = `${data.periodYear}-${String(data.periodMonth).padStart(2, "0")}-${lastDay}`

    p.ele("P5").txt(fromDate).up()
    p.ele("P5").txt(toDate).up() // P5 repeats for From/To in strict schema or use P5.1/P5.2?
    // Schema v1-1 usually uses P5 as range or separate fields.
    // Checking standard samples: usually <P5>YYYY-MM-DD</P5> <P5>YYYY-MM-DD</P5> order matters.

    // P6.1: Oznaka stjecatelja (e.g. 0001 - Radnik)
    p.ele("P6.1")
      .txt(extractLineDataField(line.lineData, "recipientType", "0001"))
      .up()

    // P6.2: Oznaka primitka (e.g. 0001 - Placa)
    p.ele("P6.2")
      .txt(extractLineDataField(line.lineData, "receiptType", "0001"))
      .up()

    // P7: Obveza dodatnog doprinosa (0 = ne)
    p.ele("P7").txt("0").up()

    // P8: Oznaka prvog/zadnjeg mjeseca (0 = ne, 1 = prvi, 2 = zadnji)
    p.ele("P8").txt("0").up()

    // P9: Oznaka punog/nepunog radnog vremena (1 = puno)
    p.ele("P9").txt("1").up()

    // P10: Sati rada
    p.ele("P10").txt("160").up() // TODO: Parametrize

    // P10.0: Sati zastoja (optional)

    // P11: Iznos primitka (Bruto)
    p.ele("P11").txt(formatAmount(gross)).up()

    // P12: Iznosdatka (Exemptions)
    p.ele("P12").txt("0.00").up()

    // P12.1 - P12.9 (Other exemptions)

    // P13.1: Doprinos za MIO I (15%)
    // Simplified: Putting full contrib here. In reality splits 15/5.
    // 20% of Gross usually.
    // If gross=1000, MIO1=150, MIO2=50.
    // Here we use inferred sum.
    p.ele("P13.1")
      .txt(formatAmount(contrib * 0.75))
      .up() // Rough estimate 15/20

    // P13.2: Doprinos za MIO II (5%)
    p.ele("P13.2")
      .txt(formatAmount(contrib * 0.25))
      .up() // Rough estimate 5/20

    // P13.3: Doprinos za zdravstveno (na placu) - usually 16.5% ON top.
    // Current model assumes 'gross' includes 'iz' (from) contributions.
    // 'Na' (on top) is usually separate cost.
    p.ele("P13.3").txt("0.00").up()

    // P13.4: Doprinos za zaposljavanje
    p.ele("P13.4").txt("0.00").up()

    // P14: Porez na dohodak i prirez
    p.ele("P14").txt(formatAmount(tax)).up()

    // P15: Osobni odbitak (Deduction used)
    // We can infer deduction used = (Income - TaxBase). But we don't have TaxBase.
    // Leave 0 for prototype.
    p.ele("P15").txt("0.00").up()

    // P16: Isplaceni primitak (Neto)
    p.ele("P16").txt(formatAmount(net)).up()

    // P17: Nacin isplate (1 = Tekuci racun)
    p.ele("P17").txt("1").up()

    p.up()
  }

  stranaB.up()

  return doc.end({ prettyPrint: true })
}
