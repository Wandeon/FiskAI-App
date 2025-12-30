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

interface SupportTicketCreatedEmailProps {
  ticketId: string
  ticketTitle: string
  ticketBody?: string
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT"
  category: string
  createdByName?: string
  createdByEmail: string
  companyName: string
  ticketUrl: string
}

const priorityColors = {
  LOW: "#6b7280",
  NORMAL: "#3b82f6",
  HIGH: "#f59e0b",
  URGENT: "#ef4444",
}

const priorityLabels = {
  LOW: "Nizak",
  NORMAL: "Normalan",
  HIGH: "Visok",
  URGENT: "Hitan",
}

const categoryLabels: Record<string, string> = {
  GENERAL: "Opće",
  BILLING: "Naplata",
  TECHNICAL: "Tehnički",
  FEATURE_REQUEST: "Zahtjev za značajkom",
  BUG: "Greška",
  OTHER: "Ostalo",
}

export default function SupportTicketCreatedEmail({
  ticketId,
  ticketTitle,
  ticketBody,
  priority,
  category,
  createdByName,
  createdByEmail,
  companyName,
  ticketUrl,
}: SupportTicketCreatedEmailProps) {
  const previewText = `Novi support tiket: ${ticketTitle}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Novi support tiket</Heading>

          <Text style={paragraph}>
            Korisnik je kreirao novi support tiket koji zahtijeva vašu pažnju.
          </Text>

          <Section style={ticketBox}>
            <Text style={ticketHeader}>
              <span
                style={{
                  ...priorityBadge,
                  backgroundColor: priorityColors[priority],
                }}
              >
                {priorityLabels[priority]}
              </span>
              <span style={categoryText}> · {categoryLabels[category] || category}</span>
            </Text>
            <Text style={ticketTitle}>{ticketTitle}</Text>
            {ticketBody && <Text style={ticketBody_style}>{ticketBody}</Text>}
          </Section>

          <Section style={detailsBox}>
            <Text style={detailLabel}>
              <strong>Tvrtka:</strong> {companyName}
            </Text>
            <Text style={detailLabel}>
              <strong>Kreirao:</strong> {createdByName || createdByEmail}
            </Text>
            <Text style={detailLabel}>
              <strong>ID tiketa:</strong> {ticketId}
            </Text>
          </Section>

          <Hr style={hr} />

          <Link href={ticketUrl} style={ctaButton}>
            Otvori tiket
          </Link>

          <Text style={footer}>
            Ovaj email je automatski generiran iz FiskAI sustava.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "560px",
}

const heading = {
  color: "#0f172a",
  fontSize: "24px",
  fontWeight: "700" as const,
  textAlign: "center" as const,
  margin: "0 0 24px",
}

const paragraph = {
  color: "#334155",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "16px 0",
}

const ticketBox = {
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  padding: "20px",
  margin: "24px 0",
  borderLeft: "4px solid #0ea5e9",
}

const ticketHeader = {
  margin: "0 0 12px",
  fontSize: "12px",
}

const priorityBadge = {
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: "600" as const,
  padding: "4px 10px",
  borderRadius: "4px",
  textTransform: "uppercase" as const,
}

const categoryText = {
  color: "#64748b",
  fontSize: "12px",
}

const ticketTitle = {
  color: "#0f172a",
  fontSize: "18px",
  fontWeight: "600" as const,
  margin: "0 0 12px",
}

const ticketBody_style = {
  color: "#475569",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0",
  whiteSpace: "pre-wrap" as const,
}

const detailsBox = {
  backgroundColor: "#f1f5f9",
  borderRadius: "8px",
  padding: "16px",
  margin: "16px 0",
}

const detailLabel = {
  color: "#475569",
  fontSize: "14px",
  margin: "6px 0",
}

const hr = {
  borderColor: "#e2e8f0",
  margin: "32px 0",
}

const ctaButton = {
  backgroundColor: "#0ea5e9",
  borderRadius: "8px",
  color: "#ffffff",
  display: "block",
  fontSize: "16px",
  fontWeight: "600" as const,
  padding: "12px 24px",
  textAlign: "center" as const,
  textDecoration: "none",
  margin: "0 auto",
}

const footer = {
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: "20px",
  textAlign: "center" as const,
  margin: "32px 0 0",
}
