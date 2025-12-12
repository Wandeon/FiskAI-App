import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
  Button,
} from '@react-email/components'

interface PasswordResetEmailProps {
  resetLink: string
  userName?: string
}

export function PasswordResetEmail({
  resetLink,
  userName,
}: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Zahtjev za resetiranje lozinke - FiskAI</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Resetiranje lozinke</Heading>
          
          <Text style={text}>
            Poštovani{userName ? ` ${userName}` : ''},
          </Text>
          
          <Text style={text}>
            Primili smo zahtjev za resetiranje lozinke vašeg FiskAI računa.
          </Text>

          <Text style={text}>
            Za postavljanje nove lozinke, kliknite na gumb ispod:
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={resetLink}>
              Resetiraj lozinku
            </Button>
          </Section>

          <Text style={text}>
            Ili kopirajte i zalijepite sljedeći link u vaš preglednik:
          </Text>

          <Text style={linkText}>
            {resetLink}
          </Text>

          <Section style={warningBox}>
            <Text style={warningText}>
              <strong>Važno:</strong>
              <br />
              • Link vrijedi 1 sat od primitka ovog e-maila
              <br />
              • Ako niste zatražili resetiranje lozinke, zanemarite ovaj e-mail
              <br />
              • Vaša lozinka neće biti promijenjena sve dok ne kliknete na link i ne unesete novu lozinku
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            S poštovanjem,
            <br />
            <strong>FiskAI Tim</strong>
          </Text>

          <Text style={footerSmall}>
            Ovo je automatizirano obavijest. Molimo ne odgovarajte na ovaj e-mail.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
}

const h1 = {
  color: '#1f2937',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0 40px',
}

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 40px',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 40px',
}

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
}

const linkText = {
  color: '#2563eb',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 40px',
  wordBreak: 'break-all' as const,
}

const warningBox = {
  backgroundColor: '#fef3c7',
  border: '1px solid #fbbf24',
  borderRadius: '8px',
  margin: '24px 40px',
  padding: '16px',
}

const warningText = {
  color: '#92400e',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
}

const hr = {
  borderColor: '#e5e7eb',
  margin: '24px 40px',
}

const footer = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '24px 40px 16px',
}

const footerSmall = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '8px 40px',
}

export default PasswordResetEmail
