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
  grid: {
    marginTop: 20,
    flexDirection: "row",
    gap: 15,
  },
  card: {
    flex: 1,
    padding: 15,
    border: 1,
    borderColor: "#ccc",
    borderRadius: 3,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#555",
  },
  cardValue: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "Courier",
  },
  cardSubtext: {
    fontSize: 9,
    color: "#666",
    marginTop: 5,
  },
  summaryCard: {
    flex: 1,
    padding: 15,
    border: 2,
    borderRadius: 3,
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
  borderGreen: {
    borderColor: "#059669",
  },
  borderRed: {
    borderColor: "#dc2626",
  },
  bgGreen: {
    backgroundColor: "#f0fdf4",
  },
  bgRed: {
    backgroundColor: "#fef2f2",
  },
})

interface ProfitLossPdfDocumentProps {
  companyName: string
  companyOib: string
  dateFrom: Date
  dateTo: Date
  revenue: number
  costs: number
  profit: number
  invoiceCount: number
  expenseCount: number
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

export function ProfitLossPdfDocument({
  companyName,
  companyOib,
  dateFrom,
  dateTo,
  revenue,
  costs,
  profit,
  invoiceCount,
  expenseCount,
}: ProfitLossPdfDocumentProps) {
  const isProfit = profit >= 0

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Dobit i gubitak</Text>
          <Text style={styles.companyInfo}>
            {companyName} | OIB: {companyOib}
          </Text>
          <Text style={styles.subtitle}>
            Razdoblje: {formatDate(dateFrom)} - {formatDate(dateTo)}
          </Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.grid}>
          {/* Revenue Card */}
          <View style={styles.card}>
            <Text style={[styles.cardTitle, styles.positive]}>Prihodi</Text>
            <Text style={[styles.cardValue, styles.positive]}>{formatCurrency(revenue)}</Text>
            <Text style={styles.cardSubtext}>{invoiceCount} računa</Text>
          </View>

          {/* Costs Card */}
          <View style={styles.card}>
            <Text style={[styles.cardTitle, styles.negative]}>Rashodi</Text>
            <Text style={[styles.cardValue, styles.negative]}>{formatCurrency(costs)}</Text>
            <Text style={styles.cardSubtext}>{expenseCount} troškova</Text>
          </View>

          {/* Profit/Loss Card */}
          <View
            style={[
              styles.summaryCard,
              isProfit ? styles.borderGreen : styles.borderRed,
              isProfit ? styles.bgGreen : styles.bgRed,
            ]}
          >
            <Text style={styles.cardTitle}>{isProfit ? "Dobit" : "Gubitak"}</Text>
            <Text style={[styles.cardValue, isProfit ? styles.positive : styles.negative]}>
              {formatCurrency(Math.abs(profit))}
            </Text>
          </View>
        </View>

        {/* Details Section */}
        <View style={{ marginTop: 40, padding: 20, backgroundColor: "#f9f9f9", borderRadius: 3 }}>
          <Text style={{ fontSize: 12, fontWeight: "bold", marginBottom: 15 }}>
            Detaljna analiza
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text>Ukupni prihodi:</Text>
            <Text style={[styles.positive, { fontFamily: "Courier" }]}>
              {formatCurrency(revenue)}
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text>Ukupni rashodi:</Text>
            <Text style={[styles.negative, { fontFamily: "Courier" }]}>
              - {formatCurrency(costs)}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              borderTop: 2,
              paddingTop: 10,
              marginTop: 10,
            }}
          >
            <Text style={{ fontWeight: "bold", fontSize: 12 }}>
              {isProfit ? "Neto dobit:" : "Neto gubitak:"}
            </Text>
            <Text
              style={[
                isProfit ? styles.positive : styles.negative,
                { fontWeight: "bold", fontSize: 12, fontFamily: "Courier" },
              ]}
            >
              {formatCurrency(Math.abs(profit))}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Generirano: {formatDate(new Date())} | FiskAI - Financijsko izvještavanje
        </Text>
      </Page>
    </Document>
  )
}
