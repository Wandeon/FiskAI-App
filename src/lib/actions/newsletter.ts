"use server"

import { drizzleDb } from "@/lib/db/drizzle"
import { newsletterSubscriptions } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { checkRateLimit } from "@/lib/security/rate-limit"
import { headers } from "next/headers"

export interface NewsletterSubscribeResult {
  success: boolean
  message: string
  alreadySubscribed?: boolean
}

function getClientIp(headersList: Headers): string {
  return (
    headersList.get("cf-connecting-ip") ??
    headersList.get("x-forwarded-for")?.split(",")[0].trim() ??
    headersList.get("x-real-ip") ??
    "unknown"
  )
}

export async function subscribeToNewsletter(
  email: string,
  source: string = "footer",
  honeypot?: string
): Promise<NewsletterSubscribeResult> {
  try {
    if (honeypot) {
      console.warn("[newsletter] Bot detected via honeypot field")
      return {
        success: true,
        message: "Uspješno ste se pretplatili! Uskoro ćete primiti potvrdu na email.",
      }
    }

    const headersList = await headers()
    const clientIp = getClientIp(headersList)

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return {
        success: false,
        message: "Molimo unesite valjanu email adresu.",
      }
    }

    const normalizedEmail = email.toLowerCase().trim()

    const ipRateLimit = await checkRateLimit(`newsletter_ip:${clientIp}`, "NEWSLETTER_IP")
    if (!ipRateLimit.allowed) {
      return {
        success: false,
        message: "Previše pokušaja s ove IP adrese. Molimo pokušajte ponovno kasnije.",
      }
    }

    const emailRateLimit = await checkRateLimit(
      `newsletter_email:${normalizedEmail}`,
      "NEWSLETTER_EMAIL"
    )
    if (!emailRateLimit.allowed) {
      return {
        success: false,
        message: "Previše pokušaja s ovom email adresom. Molimo pokušajte ponovno kasnije.",
      }
    }

    const existing = await drizzleDb
      .select()
      .from(newsletterSubscriptions)
      .where(eq(newsletterSubscriptions.email, normalizedEmail))
      .limit(1)

    if (existing.length > 0) {
      const subscription = existing[0]

      if (!subscription.isActive || subscription.unsubscribedAt) {
        await drizzleDb
          .update(newsletterSubscriptions)
          .set({
            isActive: true,
            unsubscribedAt: null,
            updatedAt: new Date(),
          })
          .where(eq(newsletterSubscriptions.email, normalizedEmail))

        return {
          success: true,
          message: "Uspješno ste ponovno pretplaćeni na newsletter!",
        }
      }

      return {
        success: true,
        message: "Već ste pretplaćeni na newsletter.",
        alreadySubscribed: true,
      }
    }

    await drizzleDb.insert(newsletterSubscriptions).values({
      email: normalizedEmail,
      source: source,
      isActive: true,
    })

    return {
      success: true,
      message: "Uspješno ste se pretplatili! Uskoro ćete primiti potvrdu na email.",
    }
  } catch (error) {
    console.error("Newsletter subscription error:", error)
    return {
      success: false,
      message: "Došlo je do greške. Molimo pokušajte ponovno.",
    }
  }
}
