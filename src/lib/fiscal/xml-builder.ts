// src/lib/fiscal/xml-builder.ts
import { create } from 'xmlbuilder2'
import { calculateZKI } from '@/lib/e-invoice/zki'
import { formatAmount, formatDateTime, generateUUID } from './utils'

const NAMESPACE = 'http://www.apis-it.hr/fin/2012/types/f73'
const SCHEMA_LOCATION = 'http://www.apis-it.hr/fin/2012/types/f73 FiskalizacijaSchema.xsd'

export interface FiscalInvoiceData {
  invoiceNumber: number
  premisesCode: string
  deviceCode: string
  issueDate: Date
  totalAmount: number
  vatRegistered: boolean
  vatBreakdown?: Array<{
    rate: number
    baseAmount: number
    vatAmount: number
  }>
  consumptionTax?: Array<{
    rate: number
    baseAmount: number
    amount: number
  }>
  exemptAmount?: number
  marginAmount?: number
  notTaxableAmount?: number
  paymentMethod: string
  operatorOib: string
  subsequentDelivery?: boolean
  paragonNumber?: string
  specificPurpose?: string
}

export interface XMLBuildResult {
  xml: string
  zki: string
  messageId: string
}

export function buildRacunRequest(
  invoice: FiscalInvoiceData,
  privateKeyPem: string,
  oib: string
): XMLBuildResult {
  const messageId = generateUUID()
  const timestamp = new Date()

  // Calculate ZKI (Zaštitni Kod Izdavatelja)
  // Note: ZKI expects amount in cents, so convert totalAmount to cents
  const zki = calculateZKI({
    oib,
    dateTime: invoice.issueDate,
    invoiceNumber: String(invoice.invoiceNumber),
    premisesCode: invoice.premisesCode,
    deviceCode: invoice.deviceCode,
    totalAmount: Math.round(invoice.totalAmount * 100)
  }, privateKeyPem)

  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele(NAMESPACE, 'tns:RacunZahtjev')
    .att('xmlns:tns', NAMESPACE)
    .att('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance')
    .att('xsi:schemaLocation', SCHEMA_LOCATION)
    .att('Id', 'RacunZahtjev')

  // Zaglavlje (Header)
  const zaglavlje = doc.ele('tns:Zaglavlje')
  zaglavlje.ele('tns:IdPoruke').txt(messageId)
  zaglavlje.ele('tns:DatumVrijeme').txt(formatDateTime(timestamp))

  // Racun (Invoice)
  const racun = doc.ele('tns:Racun')

  racun.ele('tns:Oib').txt(oib)
  racun.ele('tns:USustPdv').txt(invoice.vatRegistered ? 'true' : 'false')
  racun.ele('tns:DatVrijeme').txt(formatDateTime(invoice.issueDate))
  racun.ele('tns:OznSlijed').txt('N') // N = on premises level

  // Broj računa (Invoice number structure)
  const brojRacuna = racun.ele('tns:BrRac')
  brojRacuna.ele('tns:BrOznRac').txt(String(invoice.invoiceNumber))
  brojRacuna.ele('tns:OznPosPr').txt(invoice.premisesCode)
  brojRacuna.ele('tns:OznNapUr').txt(invoice.deviceCode)

  // PDV (VAT breakdown) - if VAT registered
  if (invoice.vatRegistered && invoice.vatBreakdown?.length) {
    const pdv = racun.ele('tns:Pdv')
    for (const vat of invoice.vatBreakdown) {
      const porez = pdv.ele('tns:Porez')
      porez.ele('tns:Stopa').txt(formatAmount(vat.rate, 2))
      porez.ele('tns:Osnovica').txt(formatAmount(vat.baseAmount, 2))
      porez.ele('tns:Iznos').txt(formatAmount(vat.vatAmount, 2))
    }
  }

  // PNP (Consumption tax) - optional
  if (invoice.consumptionTax?.length) {
    const pnp = racun.ele('tns:Pnp')
    for (const tax of invoice.consumptionTax) {
      const porez = pnp.ele('tns:Porez')
      porez.ele('tns:Stopa').txt(formatAmount(tax.rate, 2))
      porez.ele('tns:Osnovica').txt(formatAmount(tax.baseAmount, 2))
      porez.ele('tns:Iznos').txt(formatAmount(tax.amount, 2))
    }
  }

  // Oslobođenja (Exemptions)
  if (invoice.exemptAmount) {
    racun.ele('tns:IznosOslobodjen').txt(formatAmount(invoice.exemptAmount, 2))
  }

  // Marža (Margin scheme)
  if (invoice.marginAmount) {
    racun.ele('tns:IznosMarza').txt(formatAmount(invoice.marginAmount, 2))
  }

  // Ne podliježe oporezivanju (Not subject to tax)
  if (invoice.notTaxableAmount) {
    racun.ele('tns:IznosNePodlijeze').txt(formatAmount(invoice.notTaxableAmount, 2))
  }

  // Ukupni iznos (Total amount)
  racun.ele('tns:IznosUkupno').txt(formatAmount(invoice.totalAmount, 2))

  // Način plaćanja (Payment method)
  racun.ele('tns:NacinPlac').txt(mapPaymentMethod(invoice.paymentMethod))

  // OIB operatera (Operator OIB)
  racun.ele('tns:OibOper').txt(invoice.operatorOib)

  // ZKI
  racun.ele('tns:ZastKod').txt(zki)

  // Naknadna dostava (Subsequent delivery)
  racun.ele('tns:NaknadnaDost').txt(invoice.subsequentDelivery ? 'true' : 'false')

  // Paragon block number
  if (invoice.paragonNumber) {
    racun.ele('tns:ParagonBrRac').txt(invoice.paragonNumber)
  }

  // Specifična namjena (Specific purpose)
  if (invoice.specificPurpose) {
    racun.ele('tns:SpecNamjena').txt(invoice.specificPurpose)
  }

  return {
    xml: doc.end({ prettyPrint: false }),
    zki,
    messageId
  }
}

function mapPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    'CASH': 'G',
    'G': 'G',      // Gotovina (Cash)
    'CARD': 'K',
    'K': 'K',      // Kartica (Card)
    'BANK_TRANSFER': 'T',
    'T': 'T',      // Transakcijski račun (Bank transfer)
    'OTHER': 'O',
    'O': 'O',      // Ostalo (Other)
    'CHECK': 'C',
    'C': 'C',      // Ček (Check)
  }
  return map[method] || 'O'
}

export function buildStornoRequest(
  originalInvoice: FiscalInvoiceData,
  originalJir: string,
  privateKeyPem: string,
  oib: string
): XMLBuildResult {
  // Storno invoice has negative amounts
  const stornoInvoice: FiscalInvoiceData = {
    ...originalInvoice,
    totalAmount: -Math.abs(originalInvoice.totalAmount),
    vatBreakdown: originalInvoice.vatBreakdown?.map(v => ({
      ...v,
      baseAmount: -Math.abs(v.baseAmount),
      vatAmount: -Math.abs(v.vatAmount)
    })),
    specificPurpose: `STORNO ${originalJir}`
  }

  return buildRacunRequest(stornoInvoice, privateKeyPem, oib)
}
