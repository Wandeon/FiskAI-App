import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Heading,
  Button,
} from "@react-email/components"
import React from "react"

interface ClientInvitationProps {
  invitationUrl: string
  staffName: string
  message?: string
}

export default function ClientInvitation({
  invitationUrl,
  staffName,
  message,
}: ClientInvitationProps) {
  return (
    <Html lang="hr">
      <Head />
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Heading style={styles.headerTitle}>Poziv u FiskAI</Heading>
            <Text style={styles.headerSubtitle}>Vaš računovođa vas poziva</Text>
          </Section>
          <Section style={styles.content}>
            <Text style={styles.greeting}>Pozdrav,</Text>
            <Text style={styles.mainText}>
              {staffName || "Vaš računovođa"} vas poziva da se pridružite FiskAI platformi.
            </Text>
            {message && (
              <Section style={styles.messageCard}>
                <Text style={styles.messageLabel}>Poruka:</Text>
                <Text style={styles.messageText}>{message}</Text>
              </Section>
            )}
            <Text style={styles.mainText}>
              FiskAI je moderna platforma za upravljanje poslovnim financijama koja vam omogućava:
            </Text>
            <ul style={styles.featureList}>
              <li style={styles.featureItem}>Izdavanje i praćenje računa</li>
              <li style={styles.featureItem}>E-račune i fiskalizaciju</li>
              <li style={styles.featureItem}>Automatsko knjiženje transakcija</li>
              <li style={styles.featureItem}>Financijske izvještaje u realnom vremenu</li>
              <li style={styles.featureItem}>Suradnju s vašim računovođom</li>
            </ul>
            <Section style={styles.buttonContainer}>
              <Button href={invitationUrl} style={styles.button}>
                Prihvati poziv
              </Button>
            </Section>
            <Text style={styles.expiryText}>Ovaj poziv ističe za 7 dana.</Text>
            <Text style={styles.footerText}>
              Ako niste očekivali ovaj poziv, možete ga slobodno ignorirati.
            </Text>
          </Section>
          <Section style={styles.footer}>
            <Text style={styles.footerLink}>
              Imate pitanja?{" "}
              <Link href="https://fiskai.hr/contact" style={styles.link}>
                Kontaktirajte nas
              </Link>
            </Text>
            <Text style={styles.copyright}>© 2025 FiskAI. Sva prava pridržana.</Text>
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
  header: {
    background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
    color: "white",
    padding: "30px",
    textAlign: "center" as const,
  },
  headerTitle: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 600,
  },
  headerSubtitle: {
    margin: "10px 0 0 0",
    opacity: 0.9,
    fontSize: "16px",
  },
  content: {
    padding: "30px",
  },
  greeting: {
    fontSize: "16px",
    color: "#333",
    marginBottom: "10px",
  },
  mainText: {
    fontSize: "15px",
    color: "#666",
    lineHeight: "1.6",
    marginBottom: "20px",
  },
  messageCard: {
    backgroundColor: "#f0f9ff",
    padding: "20px",
    borderRadius: "6px",
    marginBottom: "20px",
    borderLeft: "4px solid #6366f1",
  },
  messageLabel: {
    fontSize: "13px",
    color: "#6366f1",
    margin: 0,
    fontWeight: 600,
    marginBottom: "8px",
  },
  messageText: {
    fontSize: "14px",
    color: "#333",
    margin: 0,
    lineHeight: "1.5",
  },
  featureList: {
    paddingLeft: "20px",
    marginTop: "10px",
    marginBottom: "20px",
  },
  featureItem: {
    fontSize: "14px",
    color: "#666",
    lineHeight: "1.8",
    marginBottom: "5px",
  },
  buttonContainer: {
    textAlign: "center" as const,
    margin: "30px 0",
  },
  button: {
    backgroundColor: "#6366f1",
    color: "#ffffff",
    padding: "14px 32px",
    borderRadius: "6px",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: "16px",
    display: "inline-block",
  },
  expiryText: {
    fontSize: "13px",
    color: "#999",
    textAlign: "center" as const,
    marginTop: "20px",
    marginBottom: "10px",
  },
  footerText: {
    fontSize: "13px",
    color: "#999",
    textAlign: "center" as const,
    marginTop: "10px",
  },
  footer: {
    backgroundColor: "#f8f9fa",
    padding: "20px",
    textAlign: "center" as const,
  },
  footerLink: {
    fontSize: "13px",
    color: "#666",
    marginBottom: "10px",
  },
  link: {
    color: "#6366f1",
    textDecoration: "none",
  },
  copyright: {
    fontSize: "12px",
    color: "#999",
    marginTop: "10px",
  },
}
