import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { Html, Head, Body, Container, Text, Link, Hr } from "@react-email/components"
import React from "react"
import { FiscalEnv } from "@prisma/client"

export interface ExpiringCertificate {
  companyId: string
  companyName: string
  ownerEmail: string
  validUntil: Date
  daysRemaining: number
}

/**
 * Find certificates expiring within a threshold
 */
export async function findExpiringCertificates(
  daysThreshold: number = 30
): Promise<ExpiringCertificate[]> {
  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold)

  const companies = await db.company.findMany({
    where: {
      fiscalCertificates: {
        some: {
          environment: FiscalEnv.PROD,
          status: "ACTIVE",
          certNotAfter: {
            lte: thresholdDate,
            gte: new Date(), // Not expired yet
          },
        },
      },
    },
    include: {
      fiscalCertificates: {
        where: {
          environment: FiscalEnv.PROD,
          status: "ACTIVE",
        },
        orderBy: {
          certNotAfter: "desc",
        },
        take: 1,
      },
      users: {
        where: { role: "OWNER" },
        include: { user: true },
      },
    },
  })

  return companies
    .filter((company) => company.fiscalCertificates.length > 0)
    .map((company) => {
      const cert = company.fiscalCertificates[0]
      const validUntil = cert.certNotAfter
      const daysRemaining = Math.ceil((validUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

      return {
        companyId: company.id,
        companyName: company.name,
        ownerEmail: company.users[0]?.user?.email || "",
        validUntil,
        daysRemaining,
      }
    })
}

/**
 * Email template for certificate expiry notification
 */
function CertificateExpiryEmail({
  companyName,
  daysRemaining,
  validUntil,
}: {
  companyName: string
  daysRemaining: number
  validUntil: string
}) {
  return React.createElement(
    Html,
    null,
    React.createElement(Head, null),
    React.createElement(
      Body,
      { style: { fontFamily: "Arial, sans-serif", backgroundColor: "#f4f4f4", padding: "20px" } },
      React.createElement(
        Container,
        {
          style: {
            backgroundColor: "#ffffff",
            padding: "30px",
            borderRadius: "8px",
            maxWidth: "600px",
          },
        },
        React.createElement(
          Text,
          { style: { fontSize: "24px", fontWeight: "bold", marginBottom: "20px" } },
          "Upozorenje: FINA certifikat ističe"
        ),
        React.createElement(
          Text,
          { style: { fontSize: "16px", marginBottom: "15px" } },
          `Poštovani,`
        ),
        React.createElement(
          Text,
          { style: { fontSize: "16px", marginBottom: "15px" } },
          `FINA certifikat za ${companyName} ističe za ${daysRemaining} dana (${validUntil}).`
        ),
        React.createElement(
          Text,
          { style: { fontSize: "16px", marginBottom: "15px" } },
          `Molimo obnovite certifikat kako biste nastavili s fiskalizacijom računa.`
        ),
        React.createElement(Hr, null),
        React.createElement(
          Text,
          { style: { fontSize: "14px", marginBottom: "10px", fontWeight: "bold" } },
          `Koraci za obnovu:`
        ),
        React.createElement(
          Text,
          { style: { fontSize: "14px", marginBottom: "5px" } },
          `1. Posjetite FINA e-usluge`
        ),
        React.createElement(
          Text,
          { style: { fontSize: "14px", marginBottom: "5px" } },
          `2. Prijavite se s vašim pristupnim podacima`
        ),
        React.createElement(
          Text,
          { style: { fontSize: "14px", marginBottom: "15px" } },
          `3. Zatražite obnovu certifikata za fiskalizaciju`
        ),
        React.createElement(
          Link,
          {
            href: "https://fina.hr/e-servisi/fiskalizacija",
            style: {
              display: "inline-block",
              backgroundColor: "#0066cc",
              color: "#ffffff",
              padding: "12px 24px",
              borderRadius: "4px",
              textDecoration: "none",
              marginBottom: "20px",
            },
          },
          "Obnovi certifikat"
        ),
        React.createElement(Hr, null),
        React.createElement(
          Text,
          { style: { fontSize: "12px", color: "#666666", marginTop: "20px" } },
          `Ova poruka je automatski generirana. Za dodatna pitanja kontaktirajte FiskAI podršku.`
        )
      )
    )
  )
}

/**
 * Send certificate expiry notification email
 */
export async function sendCertificateExpiryNotification(cert: ExpiringCertificate): Promise<void> {
  const validUntilFormatted = cert.validUntil.toLocaleDateString("hr-HR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  await sendEmail({
    to: cert.ownerEmail,
    subject: `FiskAI: FINA certifikat ističe za ${cert.daysRemaining} dana`,
    react: CertificateExpiryEmail({
      companyName: cert.companyName,
      daysRemaining: cert.daysRemaining,
      validUntil: validUntilFormatted,
    }),
  })
}
