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

interface OTPCodeEmailProps {
  code: string
  userName?: string
  type: "verify" | "login" | "reset"
}

export function OTPCodeEmail({ code, userName, type = "verify" }: OTPCodeEmailProps) {
  const subjects = {
    verify: "Potvrdite email za FiskAI",
    login: "Vaš kod za prijavu",
    reset: "Resetirajte lozinku",
  }

  const preheaders = {
    verify: "Ovaj kod vrijedi 10 minuta.",
    login: "Ovaj kod vrijedi 10 minuta.",
    reset: "Ovaj kod vrijedi 10 minuta.",
  }

  const headlines = {
    verify: "Potvrdite svoju email adresu",
    login: "Prijavite se na FiskAI",
    reset: "Resetirajte lozinku",
  }

  const descriptions = {
    verify: "Unesite kod ispod na fiskai.hr za dovršetak registracije.",
    login: "Unesite kod ispod na fiskai.hr za prijavu.",
    reset: "Unesite kod ispod na fiskai.hr za resetiranje lozinke.",
  }

  return (
    <Html>
      <Head />
      <Preview>{preheaders[type]}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Clean logo */}
          <Section style={logoSection}>
            <Text style={logo}>FiskAI</Text>
          </Section>

          {/* Content */}
          <Section style={content}>
            {/* Greeting */}
            {userName && <Text style={greeting}>Pozdrav {userName},</Text>}

            {/* Headline */}
            <Heading style={headline}>{headlines[type]}</Heading>

            {/* One sentence description */}
            <Text style={description}>{descriptions[type]}</Text>

            {/* The code - large and clear */}
            <Section style={codeContainer}>
              <Text style={codeText}>{code}</Text>
            </Section>

            {/* Expiry */}
            <Text style={expiry}>Kod vrijedi 10 minuta</Text>

            {/* Plain text fallback note */}
            <Text style={fallback}>
              Ako imate problema, kopirajte kod: <strong>{code}</strong>
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Niste zatražili ovaj kod?{" "}
              <Link href="https://fiskai.hr/kontakt" style={footerLink}>
                Javite nam se
              </Link>
            </Text>
            <Text style={footerSmall}>© {new Date().getFullYear()} FiskAI · Zagreb, Hrvatska</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Minimal, premium styles
const main = {
  backgroundColor: "#f8fafc",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
}

const container = {
  margin: "40px auto",
  maxWidth: "400px",
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
  textAlign: "center" as const,
}

const greeting = {
  color: "#64748b",
  fontSize: "15px",
  margin: "0 0 8px",
}

const headline = {
  color: "#0f172a",
  fontSize: "20px",
  fontWeight: "600" as const,
  margin: "0 0 12px",
  lineHeight: "28px",
}

const description = {
  color: "#64748b",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 32px",
}

const codeContainer = {
  backgroundColor: "#f1f5f9",
  borderRadius: "8px",
  padding: "24px",
  margin: "0 0 16px",
}

const codeText = {
  color: "#0891b2",
  fontSize: "32px",
  fontWeight: "700" as const,
  fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace",
  letterSpacing: "8px",
  margin: "0",
}

const expiry = {
  color: "#94a3b8",
  fontSize: "13px",
  margin: "0 0 24px",
}

const fallback = {
  color: "#64748b",
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0",
  padding: "16px 0 0",
  borderTop: "1px solid #e2e8f0",
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

const footerLink = {
  color: "#0891b2",
  textDecoration: "underline",
}

const footerSmall = {
  color: "#94a3b8",
  fontSize: "12px",
  margin: "0",
}

export default OTPCodeEmail
