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
} from "@react-email/components"

interface ContactFormEmailProps {
  name: string
  email: string
  businessType: string
  invoiceVolume: string
  message?: string
}

const businessTypeLabels: Record<string, string> = {
  "pausalni-obrt": "Paušalni obrt",
  "vat-obrt": "VAT obrt",
  doo: "d.o.o.",
  accountant: "Knjigovođa/računovoda",
}

const invoiceVolumeLabels: Record<string, string> = {
  "1-10": "1-10 računa mjesečno",
  "11-50": "11-50 računa mjesečno",
  "51-200": "51-200 računa mjesečno",
  "200+": "200+ računa mjesečno",
}

export function ContactFormEmail({
  name,
  email,
  businessType,
  invoiceVolume,
  message,
}: ContactFormEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Novi zahtjev za demo od {name}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <Text style={logo}>FiskAI</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading style={headline}>Novi zahtjev za demo</Heading>

            <Text style={description}>
              Primljen je novi zahtjev za demo preko kontakt forme na fiskai.hr
            </Text>

            {/* Contact Details */}
            <Section style={detailsSection}>
              <Text style={detailLabel}>Ime i prezime:</Text>
              <Text style={detailValue}>{name}</Text>

              <Text style={detailLabel}>Email adresa:</Text>
              <Text style={detailValue}>
                <Link href={`mailto:${email}`} style={emailLink}>
                  {email}
                </Link>
              </Text>

              <Text style={detailLabel}>Tip poslovanja:</Text>
              <Text style={detailValue}>{businessTypeLabels[businessType] || businessType}</Text>

              <Text style={detailLabel}>Broj računa mjesečno:</Text>
              <Text style={detailValue}>
                {invoiceVolumeLabels[invoiceVolume] || invoiceVolume}
              </Text>

              {message && (
                <>
                  <Text style={detailLabel}>Poruka:</Text>
                  <Text style={messageValue}>{message}</Text>
                </>
              )}
            </Section>

            {/* Action */}
            <Section style={actionSection}>
              <Link href={`mailto:${email}?subject=FiskAI Demo`} style={button}>
                Odgovori na zahtjev
              </Link>
            </Section>

            <Text style={footerNote}>
              Preporučeno vrijeme odgovora: unutar 24h radnim danima
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Ova email poruka je automatski generirana iz kontakt forme na fiskai.hr
            </Text>
            <Text style={footerSmall}>© {new Date().getFullYear()} FiskAI · Zagreb, Hrvatska</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: "#f8fafc",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}

const container = {
  margin: "40px auto",
  maxWidth: "600px",
}

const logoSection = {
  padding: "32px 0",
  textAlign: "center" as const,
}

const logo = {
  color: "#0891b2",
  fontSize: "24px",
  fontWeight: "700" as const,
  margin: "0",
  letterSpacing: "-0.5px",
}

const content = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  padding: "40px 32px",
}

const headline = {
  color: "#0f172a",
  fontSize: "24px",
  fontWeight: "600" as const,
  margin: "0 0 12px",
  lineHeight: "32px",
}

const description = {
  color: "#64748b",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 32px",
}

const detailsSection = {
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  padding: "24px",
  margin: "0 0 24px",
}

const detailLabel = {
  color: "#64748b",
  fontSize: "13px",
  fontWeight: "600" as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0 0 4px",
}

const detailValue = {
  color: "#0f172a",
  fontSize: "16px",
  margin: "0 0 16px",
  lineHeight: "24px",
}

const messageValue = {
  color: "#0f172a",
  fontSize: "15px",
  margin: "0",
  lineHeight: "24px",
  whiteSpace: "pre-wrap" as const,
  padding: "16px",
  backgroundColor: "#ffffff",
  borderRadius: "6px",
  border: "1px solid #e2e8f0",
}

const emailLink = {
  color: "#0891b2",
  textDecoration: "none",
}

const actionSection = {
  textAlign: "center" as const,
  margin: "24px 0",
}

const button = {
  backgroundColor: "#0891b2",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: "600" as const,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 32px",
}

const footerNote = {
  color: "#64748b",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0",
  padding: "16px 0 0",
  borderTop: "1px solid #e2e8f0",
  textAlign: "center" as const,
}

const footer = {
  padding: "24px 32px",
  textAlign: "center" as const,
}

const footerText = {
  color: "#64748b",
  fontSize: "13px",
  margin: "0 0 8px",
}

const footerSmall = {
  color: "#94a3b8",
  fontSize: "12px",
  margin: "0",
}

export default ContactFormEmail
