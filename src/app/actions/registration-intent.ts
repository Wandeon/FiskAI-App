"use server"

import { db } from "@/lib/db"
import { requireAuth } from "@/lib/auth-utils"
import { revalidatePath } from "next/cache"
import type { RegistrationIntent } from "@prisma/client"

/**
 * Save user's registration intent
 *
 * Called when a user selects their business type (Obrt or Društvo).
 * This can be called either:
 * 1. During registration (new users)
 * 2. During onboarding (backwards compatibility for users with null intent)
 *
 * Also sets intentChosenAt for analytics.
 */
export async function saveRegistrationIntent(intent: RegistrationIntent) {
  const user = await requireAuth()

  if (!user.id) {
    return { error: "Korisnik nije pronađen" }
  }

  // Validate intent value
  if (!["OBRT", "DRUSTVO"].includes(intent)) {
    return { error: "Neispravna vrsta poslovanja" }
  }

  try {
    await db.user.update({
      where: { id: user.id },
      data: {
        registrationIntent: intent,
        intentChosenAt: new Date(),
      },
    })

    revalidatePath("/onboarding")
    return { success: true }
  } catch (error) {
    console.error("[Registration Intent] Failed to save:", error)
    return { error: "Došlo je do greške. Molimo pokušajte ponovno." }
  }
}

/**
 * Get user's registration intent
 *
 * Returns the user's current registration intent and related data.
 * Used by the onboarding page to determine which flow to show.
 */
export async function getRegistrationIntent() {
  const user = await requireAuth()

  if (!user.id) {
    return { intent: null, hasCompany: false }
  }

  try {
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        registrationIntent: true,
        intentChosenAt: true,
        companies: {
          select: {
            id: true,
            company: {
              select: {
                id: true,
                name: true,
                legalForm: true,
              },
            },
          },
        },
      },
    })

    if (!dbUser) {
      return { intent: null, hasCompany: false }
    }

    // Check if user has any company with valid data
    const hasCompany = dbUser.companies.some((cu) => cu.company.name && cu.company.legalForm)

    return {
      intent: dbUser.registrationIntent,
      intentChosenAt: dbUser.intentChosenAt,
      hasCompany,
    }
  } catch (error) {
    console.error("[Registration Intent] Failed to get:", error)
    return { intent: null, hasCompany: false }
  }
}

/**
 * Clear user's registration intent
 *
 * Allows user to change their selection.
 * Used when user clicks "Change selection" on gating screens.
 */
export async function clearRegistrationIntent() {
  const user = await requireAuth()

  if (!user.id) {
    return { error: "Korisnik nije pronađen" }
  }

  try {
    await db.user.update({
      where: { id: user.id },
      data: {
        registrationIntent: null,
        // Keep intentChosenAt for analytics - shows they changed their mind
      },
    })

    revalidatePath("/onboarding")
    return { success: true }
  } catch (error) {
    console.error("[Registration Intent] Failed to clear:", error)
    return { error: "Došlo je do greške. Molimo pokušajte ponovno." }
  }
}
