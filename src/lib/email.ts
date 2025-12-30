import { Resend } from "resend"
import { z } from "zod"

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY

// Email validation schema
const emailSchema = z.string().email()

let resend: Resend | null = null

if (resendApiKey) {
  resend = new Resend(resendApiKey)
} else {
  console.warn("RESEND_API_KEY not found. Email sending will be disabled.")
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  react: React.ReactElement
  attachments?: Array<{
    filename: string
    content: Buffer
  }>
  from?: string
}

export async function sendEmail(options: SendEmailOptions) {
  if (!resend) {
    console.warn("Resend client not initialized. Skipping email send.")
    return {
      success: false,
      error: "Email service not configured. Please add RESEND_API_KEY to environment variables.",
    }
  }

  // Validate email addresses
  const emails = Array.isArray(options.to) ? options.to : [options.to]
  for (const email of emails) {
    const result = emailSchema.safeParse(email)
    if (!result.success) {
      console.error(`Invalid email address: ${email}`)
      return {
        success: false,
        error: `Invalid email address: ${email}`,
      }
    }
  }

  try {
    // Check suppression list before sending
    const { db } = await import("@/lib/db")
    const recipientEmail = emails[0] // Check first recipient

    const suppressed = await db.emailSuppression.findUnique({
      where: { email: recipientEmail },
    })

    if (suppressed) {
      // Check if suppression has expired
      if (suppressed.expiresAt && suppressed.expiresAt < new Date()) {
        // Suppression has expired, delete it and proceed
        await db.emailSuppression.delete({
          where: { id: suppressed.id },
        })
      } else {
        // Email is suppressed
        console.warn(`Email suppressed: ${recipientEmail} (${suppressed.reason})`)
        return {
          success: false,
          error: `Email address is suppressed due to ${suppressed.reason}. Details: ${suppressed.details || "N/A"}`,
        }
      }
    }

    // Check suppression list before sending
    const { db } = await import("@/lib/db")
    const recipientEmail = emails[0] // Check first recipient

    const suppressed = await db.emailSuppression.findUnique({
      where: { email: recipientEmail },
    })

    if (suppressed) {
      // Check if suppression has expired
      if (suppressed.expiresAt && suppressed.expiresAt < new Date()) {
        // Suppression has expired, delete it and proceed
        await db.emailSuppression.delete({
          where: { id: suppressed.id },
        })
      } else {
        // Email is suppressed
        console.warn(`Email suppressed: ${recipientEmail} (${suppressed.reason})`)
        return {
          success: false,
          error: `Email address is suppressed due to ${suppressed.reason}. Details: ${suppressed.details || "N/A"}`,
        }
      }
    }

    const from = options.from || process.env.RESEND_FROM_EMAIL || "noreply@fiskai.app"

    const result = await resend.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      react: options.react,
      attachments: options.attachments,
    })

    if (result.error) {
      console.error("Resend error:", result.error)
      return {
        success: false,
        error: result.error.message || "Failed to send email",
      }
    }

    return {
      success: true,
      data: result.data,
    }
  } catch (error) {
    console.error("Email sending error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

export { resend }
