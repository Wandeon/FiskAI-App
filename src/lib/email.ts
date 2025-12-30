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
