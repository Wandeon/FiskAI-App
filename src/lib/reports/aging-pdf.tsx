import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 20,
    borderBottom: 1,
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: "#666",
  },
  companyInfo: {
    marginBottom: 10,
    fontSize: 9,
  },
  summaryGrid: {
    marginTop: 15,
    marginBottom: 20,
    flexDirection: "row",
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    padding: 8,
    border: 1,
    borderRadius: 2,
  },
  summaryCardTitle: {
    fontSize: 8,
    color: "#666",
    marginBottom: 4,
  },
  summaryCardValue: {
    fontSize: 14,
    fontWeight: "bold",
  },
  summaryCardSubtext: {
    fontSize: 7,
    color: "#999",
    marginTop: 2,
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderBottom: 1,
    padding: 5,
    fontWeight: "bold",
    fontSize: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: 0.5,
    borderColor: "#e0e0e0",
    padding: 5,
    fontSize: 8,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottom: 0.5,
    borderColor: "#e0e0e0",
    padding: 5,
    backgroundColor: "#f9f9f9",
    fontSize: 8,
  },
  col1: { width: "25%" }, // Buyer
  col2: { width: "15%" }, // Invoice Number
  col3: { width: "12%" }, // Issue Date
  col4: { width: "12%" }, // Due Date
  col5: { width: "12%", textAlign: "right" }, // Days Overdue
  col6: { width: "12%", textAlign: "right" }, // Amount
  col7: { width: "12%" }, // Category
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 15,
    marginBottom: 8,
    paddingBottom: 5,
    borderBottom: 1,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 8,
    color: "#666",
    borderTop: 1,
    paddingTop: 10,
  },
  green: {
    color: "#059669",
    borderColor: "#059669",
  },
  yellow: {
    color: "#ca8a04",
    borderColor: "#ca8a04",
  },
  orange: {
    color: "#ea580c",
    borderColor: "#ea580c",
  },
  red: {
    color: "#dc2626",
    borderColor: "#dc2626",
  },
  darkRed: {
    color: "#991b1b",
    borderColor: "#991b1b",
  },
})

interface AgingPdfDocumentProps {
  companyName: string
  companyOib: string
  aging: {
    current: any[]
    days30: any[]
    days60: any[]
    days90: any[]
    over90: any[]
  }
  totals: {
    current: number
    days30: number
    days60: number
    days90: number
    over90: number
  }
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return ""
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

function getDaysOverdue(dueDate: Date | null): number {
  if (!dueDate) return 0
  const now = new Date()
  const due = new Date(dueDate)
  const diff = now.getTime() - due.getTime()
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function getAgingCategory(daysOverdue: number): string {
  if (daysOverdue === 0) return "Tekući"
  if (daysOverdue <= 30) return "1-30 dana"
  if (daysOverdue <= 60) return "31-60 dana"
  if (daysOverdue <= 90) return "61-90 dana"
  return "90+ dana"
}

export function AgingPdfDocument({
  companyName,
  companyOib,
  aging,
  totals,
}: AgingPdfDocumentProps) {
  const allInvoices = [
    ...aging.current,
    ...aging.days30,
    ...aging.days60,
    ...aging.days90,
    ...aging.over90,
  ]

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Starost potraživanja</Text>
          <Text style={styles.companyInfo}>
            {companyName} | OIB: {companyOib}
          </Text>
          <Text style={styles.subtitle}>Pregled neplaćenih računa po dospjelosti</Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, styles.green]}>
            <Text style={styles.summaryCardTitle}>Tekući</Text>
            <Text style={[styles.summaryCardValue, styles.green]}>
              {formatCurrency(totals.current)}
            </Text>
            <Text style={styles.summaryCardSubtext}>{aging.current.length} računa</Text>
          </View>
          <View style={[styles.summaryCard, styles.yellow]}>
            <Text style={styles.summaryCardTitle}>1-30 dana</Text>
            <Text style={[styles.summaryCardValue, styles.yellow]}>
              {formatCurrency(totals.days30)}
            </Text>
            <Text style={styles.summaryCardSubtext}>{aging.days30.length} računa</Text>
          </View>
          <View style={[styles.summaryCard, styles.orange]}>
            <Text style={styles.summaryCardTitle}>31-60 dana</Text>
            <Text style={[styles.summaryCardValue, styles.orange]}>
              {formatCurrency(totals.days60)}
            </Text>
            <Text style={styles.summaryCardSubtext}>{aging.days60.length} računa</Text>
          </View>
          <View style={[styles.summaryCard, styles.red]}>
            <Text style={styles.summaryCardTitle}>61-90 dana</Text>
            <Text style={[styles.summaryCardValue, styles.red]}>
              {formatCurrency(totals.days90)}
            </Text>
            <Text style={styles.summaryCardSubtext}>{aging.days90.length} računa</Text>
          </View>
          <View style={[styles.summaryCard, styles.darkRed]}>
            <Text style={styles.summaryCardTitle}>90+ dana</Text>
            <Text style={[styles.summaryCardValue, styles.darkRed]}>
              {formatCurrency(totals.over90)}
            </Text>
            <Text style={styles.summaryCardSubtext}>{aging.over90.length} računa</Text>
          </View>
        </View>

        {/* Table */}
        {allInvoices.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Detaljni pregled</Text>
            <View style={styles.tableHeader}>
              <Text style={styles.col1}>Kupac</Text>
              <Text style={styles.col2}>Broj računa</Text>
              <Text style={styles.col3}>Datum izdavanja</Text>
              <Text style={styles.col4}>Datum dospijeća</Text>
              <Text style={styles.col5}>Dana kašnjenja</Text>
              <Text style={styles.col6}>Iznos</Text>
              <Text style={styles.col7}>Kategorija</Text>
            </View>
            {allInvoices.map((invoice, idx) => {
              const daysOverdue = getDaysOverdue(invoice.dueDate)
              const category = getAgingCategory(daysOverdue)
              return (
                <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                  <Text style={styles.col1}>{invoice.buyer?.name || "N/A"}</Text>
                  <Text style={styles.col2}>{invoice.invoiceNumber || "N/A"}</Text>
                  <Text style={styles.col3}>{formatDate(invoice.issueDate)}</Text>
                  <Text style={styles.col4}>{formatDate(invoice.dueDate)}</Text>
                  <Text style={styles.col5}>{daysOverdue}</Text>
                  <Text style={styles.col6}>{formatCurrency(Number(invoice.totalAmount))}</Text>
                  <Text style={styles.col7}>{category}</Text>
                </View>
              )
            })}
          </>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Generirano: {formatDate(new Date())} | FiskAI - Praćenje potraživanja
        </Text>
      </Page>
    </Document>
  )
}
