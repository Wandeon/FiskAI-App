"use server"

import { z } from "zod"
import { marketingContactSchema } from "@/lib/validations/marketing-contact"
import { sendEmail } from "@/lib/email"
import { ContactFormEmail } from "@/lib/email/templates/contact-form-email"
import { checkRateLimit } from "@/lib/security/rate-limit"

/**
 * Server action to handle contact form submissions from the marketing site
 * Sends an email notification to info@fiskai.hr
 */
export async function submitContactForm(formData: z.infer<typeof marketingContactSchema>) {
  try {
    // Validate input
    const validatedFields = marketingContactSchema.safeParse(formData)

    if (!validatedFields.success) {
      return {
        success: false,
        error: "Molimo ispunite sva obavezna polja ispravno",
        fieldErrors: validatedFields.error.flatten().fieldErrors,
      }
    }

    const { name, email, businessType, invoiceVolume, message } = validatedFields.data

    // Rate limiting by email to prevent spam (3 attempts per hour)
    const rateLimitKey = `contact-form:${email}`
    const rateLimitResult = await checkRateLimit(rateLimitKey, "CONTACT_FORM")

    if (!rateLimitResult.allowed) {
      return {
        success: false,
        error: "Previše zahtjeva. Molimo pokušajte ponovno kasnije.",
      }
    }

    // Send email notification to info@fiskai.hr
    const emailResult = await sendEmail({
      to: "info@fiskai.hr",
      subject: `Novi zahtjev za demo - ${name}`,
      react: ContactFormEmail({
        name,
        email,
        businessType,
        invoiceVolume,
        message,
      }),
    })

    if (!emailResult.success) {
      console.error("Failed to send contact form email:", emailResult.error)
      return {
        success: false,
        error: "Došlo je do greške pri slanju poruke. Molimo kontaktirajte nas direktno na info@fiskai.hr",
      }
    }

    // Log successful submission (for monitoring)
    console.log(`Contact form submitted successfully: ${email} (${businessType}, ${invoiceVolume})`)

    return {
      success: true,
      message: "Hvala na interesu! Kontaktirat ćemo vas unutar 24h radnim danima.",
    }
  } catch (error) {
    console.error("Contact form submission error:", error)
    return {
      success: false,
      error: "Došlo je do neočekivane greške. Molimo pokušajte ponovno.",
    }
  }
}
