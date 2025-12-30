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
} from "@react-email/components"

type AdminAction = "add" | "remove" | "change-role"

interface AdminUserManagementEmailProps {
  recipientName: string
  recipientType: "owner" | "user"
  action: AdminAction
  adminEmail: string
  companyName: string
  affectedUserEmail: string
  affectedUserName?: string | null
  oldRole?: string
  newRole?: string
  ipAddress?: string | null
  timestamp: string
}

const ACTION_TITLES: Record<AdminAction, Record<"owner" | "user", string>> = {
  add: {
    owner: "Korisnik dodan u vasu tvrtku od strane administratora",
    user: "Dodani ste u tvrtku od strane administratora",
  },
  remove: {
    owner: "Korisnik uklonjen iz vase tvrtke od strane administratora",
    user: "Uklonjeni ste iz tvrtke od strane administratora",
  },
  "change-role": {
    owner: "Uloga korisnika promijenjena od strane administratora",
    user: "Vasa uloga je promijenjena od strane administratora",
  },
}

function getActionDescription(props: AdminUserManagementEmailProps): string {
  const userName = props.affectedUserName || props.affectedUserEmail

  if (props.action === "add") {
    if (props.recipientType === "owner") {
      return (
        "Administrator platforme (" +
        props.adminEmail +
        ") je dodao korisnika " +
        userName +
        ' u vasu tvrtku "' +
        props.companyName +
        '" s ulogom ' +
        (props.newRole || "MEMBER") +
        "."
      )
    }
    return (
      "Administrator platforme (" +
      props.adminEmail +
      ') vas je dodao u tvrtku "' +
      props.companyName +
      '" s ulogom ' +
      (props.newRole || "MEMBER") +
      "."
    )
  }

  if (props.action === "remove") {
    if (props.recipientType === "owner") {
      return (
        "Administrator platforme (" +
        props.adminEmail +
        ") je uklonio korisnika " +
        userName +
        ' iz vase tvrtke "' +
        props.companyName +
        '".'
      )
    }
    return (
      "Administrator platforme (" +
      props.adminEmail +
      ') vas je uklonio iz tvrtke "' +
      props.companyName +
      '".'
    )
  }

  if (props.recipientType === "owner") {
    return (
      "Administrator platforme (" +
      props.adminEmail +
      ") je promijenio ulogu korisnika " +
      userName +
      ' u vasoj tvrtki "' +
      props.companyName +
      '" iz ' +
      props.oldRole +
      " u " +
      props.newRole +
      "."
    )
  }
  return (
    "Administrator platforme (" +
    props.adminEmail +
    ') je promijenio vasu ulogu u tvrtki "' +
    props.companyName +
    '" iz ' +
    props.oldRole +
    " u " +
    props.newRole +
    "."
  )
}

export function AdminUserManagementEmail(props: AdminUserManagementEmailProps) {
  const title = ACTION_TITLES[props.action][props.recipientType]
  const description = getActionDescription(props)

  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{title}</Heading>
          <Text style={text}>Postovani {props.recipientName},</Text>
          <Text style={text}>{description}</Text>
          <Section style={highlightBox}>
            <Text style={highlightText}>
              <strong>Detalji:</strong>
              <br />
              <br />
              Tvrtka: {props.companyName}
              <br />
              Korisnik: {props.affectedUserName || props.affectedUserEmail}
              <br />
              E-mail korisnika: {props.affectedUserEmail}
              <br />
              Akcija:{" "}
              {props.action === "add"
                ? "Dodavanje"
                : props.action === "remove"
                  ? "Uklanjanje"
                  : "Promjena uloge"}
              {props.newRole && (
                <>
                  <br />
                  Nova uloga: {props.newRole}
                </>
              )}
              {props.oldRole && props.action === "change-role" && (
                <>
                  <br />
                  Prethodna uloga: {props.oldRole}
                </>
              )}
              <br />
              Vrijeme: {props.timestamp}
              {props.ipAddress && (
                <>
                  <br />
                  IP adresa administratora: {props.ipAddress}
                </>
              )}
            </Text>
          </Section>
          <Section style={warningBox}>
            <Text style={warningText}>
              <strong>Vazna napomena:</strong>
              <br />
              Ova akcija je izvrsena od strane administratora FiskAI platforme.
              Ako smatrate da je ova akcija izvrsena bez vaseg pristanka ili je
              neovlastena, molimo vas da nas odmah kontaktirate na
              podrska@fiskai.hr.
            </Text>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            Srdacan pozdrav,
            <br />
            <strong>FiskAI Tim</strong>
          </Text>
          <Text style={footerSmall}>
            Ovo je automatska obavijest o administrativnoj akciji na vasem
            racunu. Ne mozete odgovoriti na ovu poruku.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Ubuntu,sans-serif",
}

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
  maxWidth: "600px",
}

const h1 = {
  color: "#1f2937",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "40px 0",
  padding: "0 40px",
}

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "16px 40px",
}

const highlightBox = {
  backgroundColor: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: "8px",
  margin: "24px 40px",
  padding: "16px",
}

const highlightText = {
  color: "#1e40af",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0",
}

const warningBox = {
  backgroundColor: "#fef3c7",
  border: "1px solid #fcd34d",
  borderRadius: "8px",
  margin: "24px 40px",
  padding: "16px",
}

const warningText = {
  color: "#92400e",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "0",
}

const hr = {
  borderColor: "#e5e7eb",
  margin: "24px 40px",
}

const footer = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "24px 40px 16px",
}

const footerSmall = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "18px",
  margin: "8px 40px",
}

export default AdminUserManagementEmail
