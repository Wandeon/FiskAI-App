import React from "react"
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer"
import { Prisma } from "@prisma/client"

// Type definitions
type InvoiceData = {
  invoice: {
    id: string
    invoiceNumber: string
    issueDate: Date
    dueDate: Date | null
    currency: string
    netAmount: string
    vatAmount: string
    totalAmount: string
    notes: string | null
    jir: string | null
    zki: string | null
    type: string
    status: string
    includeBarcode?: boolean
  }
  seller: {
    name: string
    oib: string
    address: string
    city: string
    postalCode: string
    country: string
    email: string | null
    phone: string | null
    iban: string | null
  }
  buyer: {
    name: string
    oib: string | null
    vatNumber?: string | null
    address: string | null
    city: string | null
    postalCode: string | null
    country: string | null
  } | null
  lines: Array<{
    lineNumber: number
    description: string
    quantity: string
    unit: string
    unitPrice: string
    netAmount: string
    vatRate: string
    vatAmount: string
  }>
  bankAccount?: string
  barcodeDataUrl?: string | null
  fiscalQRDataUrl?: string | null
}

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  companyInfo: {
    fontSize: 9,
    color: "#666",
    lineHeight: 1.5,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
  },
  invoiceNumber: {
    fontSize: 14,
    marginBottom: 20,
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 5,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  column: {
    width: "48%",
  },
  partyBox: {
    padding: 10,
    backgroundColor: "#f8f9fa",
    borderRadius: 4,
  },
  partyName: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 5,
  },
  partyInfo: {
    fontSize: 9,
    color: "#666",
    lineHeight: 1.5,
  },
  table: {
    marginTop: 15,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#333",
    color: "#fff",
    padding: 8,
    fontWeight: "bold",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #ddd",
    padding: 8,
    fontSize: 9,
  },
  tableRowAlt: {
    backgroundColor: "#f8f9fa",
  },
  col1: { width: "5%" },
  col2: { width: "35%" },
  col3: { width: "10%", textAlign: "right" },
  col4: { width: "12%", textAlign: "right" },
  col5: { width: "10%", textAlign: "right" },
  col6: { width: "15%", textAlign: "right" },
  col7: { width: "13%", textAlign: "right" },
  totalsSection: {
    marginTop: 20,
    alignItems: "flex-end",
  },
  totalsBox: {
    width: "50%",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottom: "1px solid #ddd",
  },
  totalsRowTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTop: "2px solid #333",
    marginTop: 5,
    fontWeight: "bold",
    fontSize: 12,
  },
  totalsLabel: {
    fontSize: 10,
  },
  totalsValue: {
    fontSize: 10,
    fontWeight: "bold",
  },
  footer: {
    marginTop: 30,
    paddingTop: 15,
    borderTop: "1px solid #ddd",
  },
  barcodeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 10,
  },
  barcodeBox: {
    width: 120,
    height: 120,
    border: "1px solid #ddd",
    padding: 4,
  },
  barcodeLabel: {
    fontSize: 8,
    marginBottom: 4,
  },
  footerSection: {
    marginBottom: 10,
  },
  footerTitle: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 3,
  },
  footerText: {
    fontSize: 8,
    color: "#666",
    lineHeight: 1.5,
  },
  fiscalInfo: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 4,
  },
  fiscalLabel: {
    fontSize: 8,
    color: "#666",
    marginBottom: 2,
  },
  fiscalValue: {
    fontSize: 8,
    fontFamily: "Courier",
  },
  notes: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#fffbea",
    borderRadius: 4,
  },
  notesTitle: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 5,
  },
  notesText: {
    fontSize: 9,
    lineHeight: 1.5,
  },
  fiscalQRSection: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#f0f9ff",
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  fiscalQRBox: {
    width: 100,
    height: 100,
    marginRight: 15,
  },
  fiscalQRContent: {
    flex: 1,
  },
  fiscalQRTitle: {
    fontSize: 9,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#1e40af",
  },
  fiscalQRText: {
    fontSize: 8,
    lineHeight: 1.5,
    color: "#666",
    marginBottom: 3,
  },
  fiscalQRInstruction: {
    fontSize: 7,
    color: "#666",
    marginTop: 5,
    fontStyle: "italic",
  },
})

// Format currency
const Decimal = Prisma.Decimal

const formatCurrency = (amount: string, currency: string) => {
  const fixed = new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2)
  const [whole, fractional = "00"] = fixed.split(".")
  const withGrouping = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${withGrouping},${fractional} ${currency}`
}

// Format date
const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("hr-HR").format(new Date(date))
}

// Main component
export const InvoicePDFTemplate: React.FC<{ data: InvoiceData }> = ({ data }) => {
  const { invoice, seller, buyer, lines } = data
  const reverseCharge =
    Boolean(buyer?.vatNumber) &&
    !String(buyer?.vatNumber ?? "")
      .toUpperCase()
      .startsWith("HR") &&
    new Decimal(invoice.vatAmount).equals(0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header - Seller info */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{seller.name}</Text>
          <Text style={styles.companyInfo}>
            {seller.address}, {seller.postalCode} {seller.city}
          </Text>
          <Text style={styles.companyInfo}>OIB: {seller.oib}</Text>
          {seller.email && <Text style={styles.companyInfo}>Email: {seller.email}</Text>}
          {seller.phone && <Text style={styles.companyInfo}>Tel: {seller.phone}</Text>}
        </View>

        {/* Invoice title */}
        <Text style={styles.invoiceTitle}>RAČUN</Text>
        <Text style={styles.invoiceNumber}>Broj: {invoice.invoiceNumber}</Text>

        {/* Invoice dates */}
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.column}>
              <Text style={styles.sectionTitle}>Datum izdavanja</Text>
              <Text>{formatDate(invoice.issueDate)}</Text>
            </View>
            {invoice.dueDate && (
              <View style={styles.column}>
                <Text style={styles.sectionTitle}>Rok plaćanja</Text>
                <Text>{formatDate(invoice.dueDate)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Parties */}
        <View style={styles.row}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Izdavatelj</Text>
            <View style={styles.partyBox}>
              <Text style={styles.partyName}>{seller.name}</Text>
              <Text style={styles.partyInfo}>{seller.address}</Text>
              <Text style={styles.partyInfo}>
                {seller.postalCode} {seller.city}
              </Text>
              <Text style={styles.partyInfo}>OIB: {seller.oib}</Text>
            </View>
          </View>

          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Kupac</Text>
            {buyer ? (
              <View style={styles.partyBox}>
                <Text style={styles.partyName}>{buyer.name}</Text>
                {buyer.address && <Text style={styles.partyInfo}>{buyer.address}</Text>}
                {(buyer.postalCode || buyer.city) && (
                  <Text style={styles.partyInfo}>
                    {buyer.postalCode} {buyer.city}
                  </Text>
                )}
                {buyer.oib && <Text style={styles.partyInfo}>OIB: {buyer.oib}</Text>}
              </View>
            ) : (
              <View style={styles.partyBox}>
                <Text style={styles.partyInfo}>-</Text>
              </View>
            )}
          </View>
        </View>

        {/* Line items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>#</Text>
            <Text style={styles.col2}>Opis</Text>
            <Text style={styles.col3}>Kol.</Text>
            <Text style={styles.col4}>Jed.</Text>
            <Text style={styles.col5}>Cijena</Text>
            <Text style={styles.col6}>PDV</Text>
            <Text style={styles.col7}>Iznos</Text>
          </View>

          {lines.map((line, index) => (
            <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
              <Text style={styles.col1}>{line.lineNumber}</Text>
              <Text style={styles.col2}>{line.description}</Text>
              <Text style={styles.col3}>{line.quantity}</Text>
              <Text style={styles.col4}>{line.unit}</Text>
              <Text style={styles.col5}>{formatCurrency(line.unitPrice, invoice.currency)}</Text>
              <Text style={styles.col6}>{line.vatRate}%</Text>
              <Text style={styles.col7}>{formatCurrency(line.netAmount, invoice.currency)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Osnovica:</Text>
              <Text style={styles.totalsValue}>
                {formatCurrency(invoice.netAmount, invoice.currency)}
              </Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>PDV:</Text>
              <Text style={styles.totalsValue}>
                {formatCurrency(invoice.vatAmount, invoice.currency)}
              </Text>
            </View>
            <View style={styles.totalsRowTotal}>
              <Text style={styles.totalsLabel}>UKUPNO:</Text>
              <Text style={styles.totalsValue}>
                {formatCurrency(invoice.totalAmount, invoice.currency)}
              </Text>
            </View>
          </View>
        </View>

        {reverseCharge && (
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 9, color: "#111" }}>
              Prijenos porezne obveze (Reverse charge): PDV nije obračunat.
            </Text>
          </View>
        )}

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesTitle}>Napomene</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Fiscalization info */}
        {(invoice.jir || invoice.zki) && (
          <View style={styles.fiscalInfo}>
            {invoice.jir && (
              <View>
                <Text style={styles.fiscalLabel}>JIR:</Text>
                <Text style={styles.fiscalValue}>{invoice.jir}</Text>
              </View>
            )}
            {invoice.zki && (
              <View style={{ marginTop: 5 }}>
                <Text style={styles.fiscalLabel}>ZKI:</Text>
                <Text style={styles.fiscalValue}>{invoice.zki}</Text>
              </View>
            )}
          </View>
        )}

        {/* Fiscal QR Code Section */}
        {data.fiscalQRDataUrl && invoice.jir && invoice.zki && (
          <View style={styles.fiscalQRSection}>
            <View style={styles.fiscalQRBox}>
              <Image src={data.fiscalQRDataUrl} style={{ width: 100, height: 100 }} />
            </View>
            <View style={styles.fiscalQRContent}>
              <Text style={styles.fiscalQRTitle}>Ovaj račun je prijavljen Poreznoj upravi</Text>
              <Text style={styles.fiscalQRText}>JIR: {invoice.jir}</Text>
              <Text style={styles.fiscalQRText}>ZKI: {invoice.zki}</Text>
              <Text style={styles.fiscalQRInstruction}>
                Skenirajte QR kod za provjeru na porezna.gov.hr
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.barcodeRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              {seller.iban && (
                <View style={styles.footerSection}>
                  <Text style={styles.footerTitle}>Podaci za plaćanje</Text>
                  <Text style={styles.footerText}>IBAN: {seller.iban}</Text>
                  <Text style={styles.footerText}>
                    Model: HR01, Poziv na broj: {invoice.invoiceNumber.replace(/[^0-9]/g, "")}
                  </Text>
                </View>
              )}
              {data.bankAccount && (
                <View style={styles.footerSection}>
                  <Text style={styles.footerTitle}>Plaćanje na račun</Text>
                  <Text style={styles.footerText}>IBAN za uplatu: {data.bankAccount}</Text>
                </View>
              )}
            </View>

            {data.barcodeDataUrl && (
              <View style={styles.barcodeBox}>
                <Text style={styles.barcodeLabel}>Plaćanje QR kodom</Text>
                <Image src={data.barcodeDataUrl} style={{ width: 110, height: 110 }} />
              </View>
            )}
          </View>
        </View>
      </Page>
    </Document>
  )
}

// Export a function that returns the Document for use in API routes
export function InvoicePDFDocument(data: InvoiceData) {
  return <InvoicePDFTemplate data={data} />
}
