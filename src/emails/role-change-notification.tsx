import { Html, Head, Body, Container, Section, Text, Link, Heading } from "@react-email/components"
import React from "react"

interface RoleChangeNotificationProps {
  userName: string
  userEmail: string
  oldRole: string
  newRole: string
  changedBy: string
  timestamp: Date
  reason?: string
}

export default function RoleChangeNotification({
  userName,
  userEmail,
  oldRole,
  newRole,
  changedBy,
  timestamp,
  reason,
}: RoleChangeNotificationProps) {
  const isPromotion = newRole === "STAFF"
  const dateStr = timestamp.toLocaleString("hr-HR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <Html lang="hr">
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section
            style={{
              ...styles.header,
              background: isPromotion
                ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            }}
          >
            <Heading style={styles.headerTitle}>Promjena uloge</Heading>
            <Text style={styles.headerSubtitle}>FiskAI Admin Portal</Text>
          </Section>
          <Section style={styles.content}>
            <Text style={styles.greeting}>Pozdrav {userName},</Text>
            <Text style={styles.mainText}>
              Tvoja sistemska uloga na FiskAI platformi je promijenjena.
            </Text>
            <Section style={styles.detailsCard}>
              <div style={styles.detailRow}>
                <Text style={styles.detailLabel}>Stara uloga:</Text>
                <Text style={styles.detailValue}>{oldRole}</Text>
              </div>
              <div style={styles.detailRow}>
                <Text style={styles.detailLabel}>Nova uloga:</Text>
                <Text
                  style={{
                    ...styles.detailValue,
                    color: isPromotion ? "#10b981" : "#f59e0b",
                    fontWeight: 600,
                  }}
                >
                  {newRole}
                </Text>
              </div>
              <div style={styles.detailRow}>
                <Text style={styles.detailLabel}>Promijenio:</Text>
                <Text style={styles.detailValue}>{changedBy}</Text>
              </div>
              {reason && (
                <div style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Razlog:</Text>
                  <Text style={styles.detailValue}>{reason}</Text>
                </div>
              )}
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const styles = {
  body: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    backgroundColor: "#f5f5f5",
    margin: 0,
    padding: "20px",
  },
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  header: { color: "white", padding: "30px", textAlign: "center" as const },
  headerTitle: { margin: 0, fontSize: "28px", fontWeight: 600 },
  headerSubtitle: { margin: "10px 0 0 0", opacity: 0.9, fontSize: "16px" },
  content: { padding: "30px" },
  greeting: { fontSize: "16px", color: "#333", marginBottom: "10px" },
  mainText: { fontSize: "15px", color: "#666", lineHeight: "1.6", marginBottom: "20px" },
  detailsCard: {
    backgroundColor: "#f8f9fa",
    padding: "20px",
    borderRadius: "6px",
    marginBottom: "20px",
  },
  detailRow: { display: "flex", justifyContent: "space-between", marginBottom: "12px" },
  detailLabel: { fontSize: "14px", color: "#666", margin: 0, fontWeight: 500 },
  detailValue: { fontSize: "14px", color: "#333", margin: 0 },
}
