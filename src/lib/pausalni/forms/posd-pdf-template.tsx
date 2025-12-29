import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer"
import type { PosdFormData } from "./posd-generator"
import { EXPENSE_BRACKETS } from "./posd-generator"

// Croatian month names for display
const CROATIAN_MONTHS = [
  "Siječanj",
  "Veljača",
  "Ožujak",
  "Travanj",
  "Svibanj",
  "Lipanj",
  "Srpanj",
  "Kolovoz",
  "Rujan",
  "Listopad",
  "Studeni",
  "Prosinac",
]

// Register fonts (using Helvetica as fallback since it's built-in)
Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica" },
    { src: "Helvetica-Bold", fontWeight: "bold" },
  ],
})

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    borderBottom: "2pt solid #2563eb",
    paddingBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: "1pt solid #e2e8f0",
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: "50%",
    color: "#64748b",
  },
  value: {
    width: "50%",
    fontWeight: "bold",
  },
  highlightBox: {
    backgroundColor: "#eff6ff",
    padding: 12,
    borderRadius: 4,
    marginBottom: 15,
    borderLeft: "3pt solid #2563eb",
  },
  highlightLabel: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 4,
  },
  highlightValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1e40af",
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontWeight: "bold",
    color: "#475569",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    padding: 6,
    borderBottom: "1pt solid #e2e8f0",
  },
  tableCell: {
    fontSize: 9,
  },
  col1: { width: "25%" },
  col2: { width: "40%", textAlign: "right" as const },
  col3: { width: "35%", textAlign: "right" as const },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    borderTop: "1pt solid #e2e8f0",
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "center" as const,
  },
  warningBox: {
    backgroundColor: "#fef3c7",
    padding: 10,
    borderRadius: 4,
    marginTop: 15,
    borderLeft: "3pt solid #f59e0b",
  },
  warningText: {
    fontSize: 9,
    color: "#92400e",
  },
  summaryGrid: {
    flexDirection: "row",
    marginTop: 10,
  },
  summaryBox: {
    flex: 1,
    padding: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    marginRight: 8,
  },
  summaryBoxLast: {
    flex: 1,
    padding: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 4,
  },
  summaryLabel: {
    fontSize: 8,
    color: "#64748b",
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#0f172a",
  },
  netIncomeBox: {
    backgroundColor: "#dcfce7",
    padding: 12,
    borderRadius: 4,
    marginTop: 10,
    borderLeft: "3pt solid #22c55e",
  },
})

interface Props {
  data: PosdFormData
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function PosdPDFDocument({ data }: Props) {
  const expenseLabel =
    EXPENSE_BRACKETS.find((b) => b.value === data.expenseBracket)?.label || ""
  const generatedDate = new Date().toLocaleDateString("hr-HR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>PO-SD Obrazac</Text>
          <Text style={styles.subtitle}>
            Prijava poreza na dohodak za paušalni obrt - {data.periodYear}. godina
          </Text>
        </View>

        {/* Company Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Podaci o poreznom obvezniku</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Naziv obrta:</Text>
            <Text style={styles.value}>{data.companyName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>OIB:</Text>
            <Text style={styles.value}>{data.companyOib}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Adresa:</Text>
            <Text style={styles.value}>{data.companyAddress}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Mjesto:</Text>
            <Text style={styles.value}>
              {data.companyPostalCode} {data.companyCity}
            </Text>
          </View>
          {data.activityCode && (
            <View style={styles.row}>
              <Text style={styles.label}>Šifra djelatnosti:</Text>
              <Text style={styles.value}>{data.activityCode}</Text>
            </View>
          )}
        </View>

        {/* Period */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Porezno razdoblje</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Godina:</Text>
            <Text style={styles.value}>{data.periodYear}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Vrsta prijave:</Text>
            <Text style={styles.value}>Godišnja prijava</Text>
          </View>
        </View>

        {/* Income Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pregled prihoda</Text>

          <View style={styles.highlightBox}>
            <Text style={styles.highlightLabel}>I. Ukupan godišnji primitak</Text>
            <Text style={styles.highlightValue}>{formatCurrency(data.grossIncome)}</Text>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLabel}>
                II. Priznati troškovi ({data.expenseBracket}%)
              </Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(data.calculatedExpenses)}
              </Text>
              <Text style={{ fontSize: 8, color: "#64748b", marginTop: 2 }}>
                {expenseLabel}
              </Text>
            </View>
            <View style={styles.summaryBoxLast}>
              <Text style={styles.summaryLabel}>Broj izdanih računa</Text>
              <Text style={styles.summaryValue}>{data.invoiceCount}</Text>
            </View>
          </View>

          <View style={styles.netIncomeBox}>
            <Text style={styles.highlightLabel}>III. Dohodak (porezna osnovica)</Text>
            <Text style={styles.highlightValue}>{formatCurrency(data.netIncome)}</Text>
          </View>
        </View>

        {/* Monthly Breakdown */}
        {data.monthlyBreakdown && data.monthlyBreakdown.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mjesečni pregled primitaka</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.col1]}>Mjesec</Text>
                <Text style={[styles.tableHeaderCell, styles.col2]}>Primitak</Text>
                <Text style={[styles.tableHeaderCell, styles.col3]}>Broj računa</Text>
              </View>
              {data.monthlyBreakdown.map((month) => (
                <View key={month.month} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.col1]}>
                    {CROATIAN_MONTHS[month.month - 1]}
                  </Text>
                  <Text style={[styles.tableCell, styles.col2]}>
                    {formatCurrency(month.income)}
                  </Text>
                  <Text style={[styles.tableCell, styles.col3]}>{month.invoiceCount}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Warning */}
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            NAPOMENA: Ovaj dokument služi kao priprema za podnošenje PO-SD obrasca. Za
            službenu prijavu morate pristupiti portalu ePorezna i unijeti podatke iz ovog
            dokumenta. Rok za podnošenje je 15. siječnja za prethodnu godinu.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generirano: {generatedDate} | FiskAI - Sustav za paušalne obrte
          </Text>
        </View>
      </Page>
    </Document>
  )
}
