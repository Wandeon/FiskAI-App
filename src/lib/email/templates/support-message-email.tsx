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

interface SupportMessageEmailProps {
  ticketId: string
  ticketTitle: string
  messageBody: string
  authorName?: string
  authorEmail: string
  companyName: string
  ticketUrl: string
}

export default function SupportMessageEmail({
  ticketId,
  ticketTitle,
  messageBody,
  authorName,
  authorEmail,
  companyName,
  ticketUrl,
}: SupportMessageEmailProps) {
  const previewText = `Nova poruka na tiketu: ${ticketTitle}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Nova poruka na support tiketu</Heading>

          <Text style={paragraph}>
            Primili ste novu poruku na support tiketu <strong>{ticketTitle}</strong>.
          </Text>

          <Section style={messageBox}>
            <Text style={authorText}>
              <strong>{authorName || authorEmail}</strong>
            </Text>
            <Text style={messageBody_style}>{messageBody}</Text>
          </Section>

          <Section style={detailsBox}>
            <Text style={detailLabel}>
              <strong>Tvrtka:</strong> {companyName}
            </Text>
            <Text style={detailLabel}>
              <strong>ID tiketa:</strong> {ticketId}
            </Text>
          </Section>

          <Hr style={hr} />

          <Link href={ticketUrl} style={ctaButton}>
            Odgovori na tiket
          </Link>

          <Text style={footer}>Ovaj email je automatski generiran iz FiskAI sustava.</Text>
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

const messageBox = {
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  padding: "20px",
  margin: "24px 0",
  borderLeft: "4px solid #10b981",
}

const authorText = {
  color: "#0f172a",
  fontSize: "14px",
  margin: "0 0 12px",
}

const messageBody_style = {
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
