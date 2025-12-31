import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    borderBottom: 1,
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 11,
    color: "#666",
    marginBottom: 3,
  },
  companyInfo: {
    marginBottom: 5,
    fontSize: 10,
  },
  section: {
    marginTop: 15,
    padding: 15,
    backgroundColor: "#f5f5f5",
    borderRadius: 3,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    fontSize: 10,
  },
  label: {
    color: "#555",
  },
  value: {
    fontWeight: "bold",
    fontFamily: "Courier",
  },
  divider: {
    borderTop: 1,
    borderColor: "#ccc",
    marginTop: 8,
    marginBottom: 8,
  },
  summarySection: {
    marginTop: 20,
    padding: 15,
    borderWidth: 2,
    borderColor: "#333",
    borderRadius: 3,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
    fontSize: 11,
  },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTop: 2,
    borderColor: "#333",
    fontSize: 14,
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#666",
    borderTop: 1,
    paddingTop: 10,
  },
  positive: {
    color: "#059669",
  },
  negative: {
    color: "#dc2626",
  },
})

interface VatPdfDocumentProps {
  companyName: string
  companyOib: string
  dateFrom: Date
  dateTo: Date
  outputVat: {
    net: number
    vat: number
    total: number
  }
  inputVat: {
    deductible: number
    nonDeductible: number
    total: number
  }
  vatPayable: number
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("hr-HR")
}

function formatCurrency(amount: number): string {
  return (
    new Intl.NumberFormat("hr-HR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      currency: "EUR",
    }).format(amount) + " €"
  )
}

export function VatPdfDocument({
  companyName,
  companyOib,
  dateFrom,
  dateTo,
  outputVat,
  inputVat,
  vatPayable,
}: VatPdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>PDV Obrazac</Text>
          <Text style={styles.companyInfo}>
            {companyName} | OIB: {companyOib}
          </Text>
          <Text style={styles.subtitle}>
            Razdoblje: {formatDate(dateFrom)} - {formatDate(dateTo)}
          </Text>
        </View>

        {/* Output VAT Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Izlazni PDV (iz računa)</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Osnovica:</Text>
            <Text style={styles.value}>{formatCurrency(outputVat.net)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>PDV:</Text>
            <Text style={[styles.value, styles.positive]}>{formatCurrency(outputVat.vat)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Ukupno računi:</Text>
            <Text style={styles.value}>{formatCurrency(outputVat.total)}</Text>
          </View>
        </View>

        {/* Input VAT Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ulazni PDV (iz troškova)</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Priznati PDV:</Text>
            <Text style={[styles.value, styles.positive]}>
              {formatCurrency(inputVat.deductible)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Nepriznati PDV:</Text>
            <Text style={styles.value}>{formatCurrency(inputVat.nonDeductible)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Ukupno PDV:</Text>
            <Text style={styles.value}>{formatCurrency(inputVat.total)}</Text>
          </View>
        </View>

        {/* VAT Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>Obveza PDV-a</Text>
          <View style={styles.summaryRow}>
            <Text>Izlazni PDV:</Text>
            <Text style={styles.value}>{formatCurrency(outputVat.vat)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>Ulazni PDV (priznati):</Text>
            <Text style={styles.value}>- {formatCurrency(inputVat.deductible)}</Text>
          </View>
          <View style={styles.summaryTotal}>
            <Text>{vatPayable >= 0 ? "Za uplatu:" : "Za povrat:"}</Text>
            <Text style={vatPayable >= 0 ? styles.negative : styles.positive}>
              {formatCurrency(Math.abs(vatPayable))}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Generirano: {formatDate(new Date())} | FiskAI - PDV izvještavanje
        </Text>
      </Page>
    </Document>
  )
}
