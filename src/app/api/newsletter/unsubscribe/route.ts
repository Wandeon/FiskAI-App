import { NextResponse } from "next/server"
import { z } from "zod"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsletterSubscriptions } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { parseQuery, isValidationError, formatValidationError } from "@/lib/api/validation"

const querySchema = z.object({
  token: z.string().min(1, "Missing unsubscribe token"),
})

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const { token } = parseQuery(searchParams, querySchema)

    // Decode email from token (simple base64 - in production use signed tokens)
    let email: string
    try {
      email = Buffer.from(token, "base64").toString("utf-8")
    } catch {
      return new NextResponse("Invalid unsubscribe token", { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new NextResponse("Invalid email format", { status: 400 })
    }

    // Update subscription to inactive
    await drizzleDb
      .update(newsletterSubscriptions)
      .set({
        isActive: false,
        unsubscribedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(newsletterSubscriptions.email, email))

    // Return simple HTML page confirming unsubscribe
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html lang="hr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Odjava s newslettera - FiskAI</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background-color: #f5f5f5;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .container {
              background: white;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              max-width: 500px;
              text-align: center;
            }
            h1 {
              color: #333;
              margin-bottom: 20px;
            }
            p {
              color: #666;
              line-height: 1.6;
              margin-bottom: 20px;
            }
            a {
              color: #667eea;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Uspješno odjavljen</h1>
            <p>Odjavljeni ste s FiskAI newslettera.</p>
            <p>Nećete više primati vijesti putem e-maila.</p>
            <p>Ako želite ponovno primati vijesti, možete se ponovno pretplatiti na <a href="https://fiskai.hr/vijesti">stranici s vijestima</a>.</p>
            <p><a href="https://fiskai.hr">← Povratak na FiskAI</a></p>
          </div>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      }
    )
  } catch (error) {
    if (isValidationError(error)) {
      return new NextResponse(JSON.stringify(formatValidationError(error)), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }
    console.error("Unsubscribe error:", error)
    return new NextResponse("An error occurred while unsubscribing", { status: 500 })
  }
}
