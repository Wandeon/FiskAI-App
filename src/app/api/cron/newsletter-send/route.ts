import { NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsletterSubscriptions } from "@/lib/db/schema"
import { sendEmail } from "@/lib/email"
import { getRecentNewsForDigest } from "@/lib/newsletter/digest"
import NewsDigestEmail from "@/emails/news-digest"
import React from "react"
import { eq } from "drizzle-orm"

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get recent news posts (last 24 hours)
    const posts = await getRecentNewsForDigest(24)

    // If no new posts, skip sending
    if (posts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No new posts to send",
        sent: 0,
      })
    }

    // Get all active subscribers
    const subscribers = await drizzleDb
      .select({
        email: newsletterSubscriptions.email,
        id: newsletterSubscriptions.id,
      })
      .from(newsletterSubscriptions)
      .where(eq(newsletterSubscriptions.isActive, true))

    if (subscribers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active subscribers",
        sent: 0,
        postsFound: posts.length,
      })
    }

    // Send email to each subscriber
    const emailResults = []
    for (const subscriber of subscribers) {
      // Generate simple unsubscribe token (in production, use proper JWT or signed token)
      const unsubscribeToken = Buffer.from(subscriber.email).toString("base64")

      const result = await sendEmail({
        to: subscriber.email,
        subject: `FiskAI Vijesti - ${new Date().toLocaleDateString("hr-HR")}`,
        react: React.createElement(NewsDigestEmail, { posts, unsubscribeToken }),
      })

      emailResults.push({
        email: subscriber.email,
        success: result.success,
        error: result.error,
      })

      // Add small delay between sends to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    const successCount = emailResults.filter((r) => r.success).length
    const failedCount = emailResults.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failedCount,
      totalSubscribers: subscribers.length,
      postsIncluded: posts.length,
      posts: posts.map((p) => ({ title: p.title, slug: p.slug })),
      results: emailResults,
    })
  } catch (error) {
    console.error("Newsletter send error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
