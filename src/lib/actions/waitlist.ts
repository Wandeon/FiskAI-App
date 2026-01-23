"use server"

import { z } from "zod"
import { eq } from "drizzle-orm"
import { drizzleDb } from "@/lib/db/drizzle"
import { regulatoryCompanionSubscribers } from "@/lib/db/schema/regulatory-companion"
import { logger } from "@/lib/logger"
import { headers } from "next/headers"
import { WAITLIST_TYPES, type WaitlistType } from "./waitlist.types"

/**
 * Schema for waitlist signup
 */
const waitlistSignupSchema = z.object({
  email: z
    .string()
    .email("Unesite ispravnu email adresu")
    .max(255, "Email je predugačak")
    .transform((v) => v.toLowerCase().trim()),
  waitlistType: z.enum(WAITLIST_TYPES, {
    message: "Neispravna vrsta prijave",
  }),
})

/**
 * Get client IP from headers
 */
function getClientIp(headersList: Headers): string {
  return (
    headersList.get("cf-connecting-ip") ??
    headersList.get("x-forwarded-for")?.split(",")[0].trim() ??
    headersList.get("x-real-ip") ??
    "unknown"
  )
}

/**
 * Sign up for waitlist
 *
 * Used when users select a business type that is not yet supported:
 * - Društvo (j.d.o.o. or d.o.o.)
 * - Obrt na dohodak
 * - Obrt u sustavu PDV-a
 *
 * Stores the email and selected type in regulatoryCompanionSubscribers table
 * with source = "onboarding-waitlist"
 */
export async function signupForWaitlist(data: { email: string; waitlistType: WaitlistType }) {
  try {
    // Validate input
    const validatedData = waitlistSignupSchema.parse(data)

    // Get client info
    const headersList = await headers()
    const clientIp = getClientIp(headersList)
    const userAgent = headersList.get("user-agent") || null

    logger.info(
      { email: validatedData.email, waitlistType: validatedData.waitlistType },
      "[Waitlist] Signup request received"
    )

    // Check if email already exists
    const existing = await drizzleDb
      .select()
      .from(regulatoryCompanionSubscribers)
      .where(eq(regulatoryCompanionSubscribers.email, validatedData.email))
      .limit(1)

    if (existing.length > 0) {
      const subscriber = existing[0]

      // If already subscribed and active, update businessType if different
      if (!subscriber.unsubscribedAt) {
        if (subscriber.businessType !== validatedData.waitlistType) {
          await drizzleDb
            .update(regulatoryCompanionSubscribers)
            .set({
              businessType: validatedData.waitlistType,
              updatedAt: new Date(),
              source: "onboarding-waitlist",
            })
            .where(eq(regulatoryCompanionSubscribers.email, validatedData.email))

          logger.info(
            { email: validatedData.email, waitlistType: validatedData.waitlistType },
            "[Waitlist] Updated existing subscriber's type"
          )
        }

        return {
          success: true,
          message: "Hvala! Već ste prijavljeni na listu čekanja.",
          alreadySubscribed: true,
        }
      }

      // If previously unsubscribed, resubscribe
      await drizzleDb
        .update(regulatoryCompanionSubscribers)
        .set({
          businessType: validatedData.waitlistType,
          unsubscribedAt: null,
          subscribedAt: new Date(),
          updatedAt: new Date(),
          source: "onboarding-waitlist",
          ipAddress: clientIp,
          userAgent: userAgent,
        })
        .where(eq(regulatoryCompanionSubscribers.email, validatedData.email))

      logger.info(
        { email: validatedData.email },
        "[Waitlist] Resubscribed previously unsubscribed user"
      )

      return {
        success: true,
        message: "Hvala! Uspješno ste se prijavili na listu čekanja.",
      }
    }

    // Insert new subscriber
    await drizzleDb.insert(regulatoryCompanionSubscribers).values({
      email: validatedData.email,
      businessType: validatedData.waitlistType,
      source: "onboarding-waitlist",
      ipAddress: clientIp,
      userAgent: userAgent,
    })

    logger.info(
      { email: validatedData.email, waitlistType: validatedData.waitlistType },
      "[Waitlist] New subscriber created"
    )

    return {
      success: true,
      message: "Hvala! Uspješno ste se prijavili na listu čekanja.",
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.issues[0]?.message || "Neispravni podaci"
      return { success: false, error: firstError }
    }

    logger.error({ error }, "[Waitlist] Internal error")
    return { success: false, error: "Došlo je do greške. Molimo pokušajte ponovno." }
  }
}
