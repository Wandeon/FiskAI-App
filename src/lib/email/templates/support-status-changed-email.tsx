import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components"

interface SupportStatusChangedEmailProps {
  ticketId: string
  ticketTitle: string
  oldStatus: string
  newStatus: string
  changedByName?: string
  changedByEmail: string
  companyName: string
  ticketUrl: string
}

const statusLabels: Record<string, string> = {
  OPEN: "Otvoren",
  IN_PROGRESS: "U tijeku",
  RESOLVED: "Riješen",
  CLOSED: "Zatvoren",
}

const statusColors: Record<string, string> = {
  OPEN: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  RESOLVED: "#10b981",
  CLOSED: "#6b7280",
}

export default function SupportStatusChangedEmail({
  ticketId,
  ticketTitle,
  oldStatus,
  newStatus,
  changedByName,
  changedByEmail,
  companyName,
  ticketUrl,
}: SupportStatusChangedEmailProps) {
  const previewText = `Status tiketa promijenjen: ${ticketTitle}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Status tiketa promijenjen</Heading>
          <Text style={paragraph}>
            Status support tiketa <strong>{ticketTitle}</strong> je promijenjen.
          </Text>
          <Section style={statusBox}>
            <Text style={statusTitle}>{ticketTitle}</Text>
            <Text style={statusChange}>
              <span style={{ ...statusBadge, backgroundColor: statusColors[oldStatus] || "#6b7280" }}>
                {statusLabels[oldStatus] || oldStatus}
              </span>
              <span style={arrow}> → </span>
              <span style={{ ...statusBadge, backgroundColor: statusColors[newStatus] || "#6b7280" }}>
                {statusLabels[newStatus] || newStatus}
              </span>
            </Text>
          </Section>
          <Section style={detailsBox}>
            <Text style={detailLabel}><strong>Tvrtka:</strong> {companyName}</Text>
            <Text style={detailLabel}><strong>Promijenio:</strong> {changedByName || changedByEmail}</Text>
            <Text style={detailLabel}><strong>ID tiketa:</strong> {ticketId}</Text>
          </Section>
          <Hr style={hr} />
          <Link href={ticketUrl} style={ctaButton}>Otvori tiket</Link>
          <Text style={footer}>Ovaj email je automatski generiran iz FiskAI sustava.</Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = { backgroundColor: "#f6f9fc", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif' }
const container = { backgroundColor: "#ffffff", margin: "0 auto", padding: "40px 20px", maxWidth: "560px" }
const heading = { color: "#0f172a", fontSize: "24px", fontWeight: "700" as const, textAlign: "center" as const, margin: "0 0 24px" }
const paragraph = { color: "#334155", fontSize: "16px", lineHeight: "24px", margin: "16px 0" }
const statusBox = { backgroundColor: "#f8fafc", borderRadius: "8px", padding: "20px", margin: "24px 0", borderLeft: "4px solid #8b5cf6", textAlign: "center" as const }
const statusTitle = { color: "#0f172a", fontSize: "18px", fontWeight: "600" as const, margin: "0 0 16px" }
const statusChange = { fontSize: "14px", margin: "0", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }
const statusBadge = { color: "#ffffff", fontSize: "12px", fontWeight: "600" as const, padding: "6px 12px", borderRadius: "4px", textTransform: "uppercase" as const, display: "inline-block" }
const arrow = { color: "#64748b", fontSize: "16px", fontWeight: "bold" as const }
const detailsBox = { backgroundColor: "#f1f5f9", borderRadius: "8px", padding: "16px", margin: "16px 0" }
const detailLabel = { color: "#475569", fontSize: "14px", margin: "6px 0" }
const hr = { borderColor: "#e2e8f0", margin: "32px 0" }
const ctaButton = { backgroundColor: "#0ea5e9", borderRadius: "8px", color: "#ffffff", display: "block", fontSize: "16px", fontWeight: "600" as const, padding: "12px 24px", textAlign: "center" as const, textDecoration: "none", margin: "0 auto" }
const footer = { color: "#94a3b8", fontSize: "12px", lineHeight: "20px", textAlign: "center" as const, margin: "32px 0 0" }
