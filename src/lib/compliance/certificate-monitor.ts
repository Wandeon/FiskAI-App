import { db } from "@/lib/db"
import { sendEmail } from "@/lib/email"
import { Html, Head, Body, Container, Text, Link, Hr } from "@react-email/components"
import React from "react"
import { FiscalEnv } from "@prisma/client"

// Standard notification intervals (days before expiry)
export const NOTIFICATION_INTERVALS = [30, 14, 7, 1] as const
export type NotificationInterval = (typeof NOTIFICATION_INTERVALS)[number]

export interface ExpiringCertificate {
  certificateId: string
  companyId: string
  companyName: string
  ownerEmail: string
  validUntil: Date
  daysRemaining: number
  lastNotificationDay: number | null
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
        certificateId: cert.id,
        companyId: company.id,
        companyName: company.name,
        ownerEmail: company.users[0]?.user?.email || "",
        validUntil,
        daysRemaining,
        lastNotificationDay: cert.lastExpiryNotificationDay,
      }
    })
}

/**
 * Determine if a notification should be sent based on days remaining and last notification
 * Returns the notification interval to use, or null if no notification needed
 */
export function shouldSendNotification(
  daysRemaining: number,
  lastNotificationDay: number | null
): NotificationInterval | null {
  // Find the current notification interval (highest interval <= daysRemaining)
  const currentInterval = NOTIFICATION_INTERVALS.find((interval) => daysRemaining <= interval)

  if (!currentInterval) {
    return null // More than 30 days remaining, no notification needed
  }

  // If no notification has been sent, send one
  if (lastNotificationDay === null) {
    return currentInterval
  }

  // Only send if we've crossed into a new (lower) interval
  if (currentInterval < lastNotificationDay) {
    return currentInterval
  }

  return null
}

/**
 * Update notification tracking after sending
 */
export async function updateNotificationTracking(
  certificateId: string,
  notificationDay: NotificationInterval
): Promise<void> {
  await db.fiscalCertificate.update({
    where: { id: certificateId },
    data: {
      lastExpiryNotificationAt: new Date(),
      lastExpiryNotificationDay: notificationDay,
    },
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
          "Upozorenje: FINA certifikat istice"
        ),
        React.createElement(
          Text,
          { style: { fontSize: "16px", marginBottom: "15px" } },
          "Postovani,"
        ),
        React.createElement(
          Text,
          { style: { fontSize: "16px", marginBottom: "15px" } },
          `FINA certifikat za ${companyName} istice za ${daysRemaining} dana (${validUntil}).`
        ),
        React.createElement(
          Text,
          { style: { fontSize: "16px", marginBottom: "15px" } },
          "Molimo obnovite certifikat kako biste nastavili s fiskalizacijom racuna."
        ),
        React.createElement(Hr, null),
        React.createElement(
          Text,
          { style: { fontSize: "14px", marginBottom: "10px", fontWeight: "bold" } },
          "Koraci za obnovu:"
        ),
        React.createElement(
          Text,
          { style: { fontSize: "14px", marginBottom: "5px" } },
          "1. Posjetite FINA e-usluge"
        ),
        React.createElement(
          Text,
          { style: { fontSize: "14px", marginBottom: "5px" } },
          "2. Prijavite se s vasim pristupnim podacima"
        ),
        React.createElement(
          Text,
          { style: { fontSize: "14px", marginBottom: "15px" } },
          "3. Zatrazite obnovu certifikata za fiskalizaciju"
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
          "Ova poruka je automatski generirana. Za dodatna pitanja kontaktirajte FiskAI podrsku."
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
    subject: `FiskAI: FINA certifikat istice za ${cert.daysRemaining} dana`,
    react: CertificateExpiryEmail({
      companyName: cert.companyName,
      daysRemaining: cert.daysRemaining,
      validUntil: validUntilFormatted,
    }),
  })
}
