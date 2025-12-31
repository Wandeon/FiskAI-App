import { ImageResponse } from "next/og"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsPosts, newsCategories } from "@/lib/db/schema"
import { eq, and, lte } from "drizzle-orm"

export const runtime = "nodejs" // Need node runtime for drizzle/postgres
export const alt = "FiskAI Vijesti"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

interface Props {
  params: Promise<{ slug: string }>
}

export default async function OGImage({ params }: Props) {
  const { slug } = await params

  // Fetch post data
  const result = await drizzleDb
    .select({
      title: newsPosts.title,
      excerpt: newsPosts.excerpt,
      categoryName: newsCategories.nameHr,
      impactLevel: newsPosts.impactLevel,
    })
    .from(newsPosts)
    .leftJoin(newsCategories, eq(newsPosts.categoryId, newsCategories.id))
    .where(
      and(
        eq(newsPosts.slug, slug),
        eq(newsPosts.status, "published"),
        lte(newsPosts.publishedAt, new Date())
      )
    )
    .limit(1)

  const post = result[0]

  if (!post) {
    // Fallback image for missing posts
    return new ImageResponse(
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f172a",
          fontSize: "40px",
          color: "white",
        }}
      >
        FiskAI Vijesti
      </div>,
      { ...size }
    )
  }

  // Determine impact level colors
  const impactColors = {
    high: { bg: "rgba(239, 68, 68, 0.2)", border: "rgba(239, 68, 68, 0.5)", text: "#fca5a5" },
    medium: { bg: "rgba(234, 179, 8, 0.2)", border: "rgba(234, 179, 8, 0.5)", text: "#fde047" },
    low: { bg: "rgba(34, 197, 94, 0.2)", border: "rgba(34, 197, 94, 0.5)", text: "#86efac" },
  }
  const impact = impactColors[post.impactLevel as keyof typeof impactColors] || impactColors.low

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0f172a",
        backgroundImage:
          "radial-gradient(circle at 25% 25%, rgba(56, 189, 248, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.1) 0%, transparent 50%)",
        padding: "60px",
      }}
    >
      {/* Header with category and impact */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginBottom: "30px",
        }}
      >
        {/* Category badge */}
        {post.categoryName && (
          <div
            style={{
              padding: "8px 20px",
              borderRadius: "999px",
              background: "rgba(56, 189, 248, 0.2)",
              border: "1px solid rgba(56, 189, 248, 0.5)",
              fontSize: "18px",
              color: "#7dd3fc",
            }}
          >
            {post.categoryName}
          </div>
        )}
        {/* Impact badge */}
        {post.impactLevel && (
          <div
            style={{
              padding: "8px 20px",
              borderRadius: "999px",
              background: impact.bg,
              border: `1px solid ${impact.border}`,
              fontSize: "18px",
              color: impact.text,
            }}
          >
            {post.impactLevel === "high"
              ? "Visok utjecaj"
              : post.impactLevel === "medium"
                ? "Srednji utjecaj"
                : "Nizak utjecaj"}
          </div>
        )}
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: "52px",
          fontWeight: "bold",
          color: "white",
          lineHeight: 1.2,
          marginBottom: "24px",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {post.title}
      </div>

      {/* Excerpt */}
      {post.excerpt && (
        <div
          style={{
            fontSize: "24px",
            color: "rgba(255, 255, 255, 0.7)",
            lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            marginBottom: "auto",
          }}
        >
          {post.excerpt}
        </div>
      )}

      {/* Footer with branding */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: "bold",
              color: "white",
            }}
          >
            F
          </div>
          <span
            style={{
              fontSize: "28px",
              fontWeight: "bold",
              background: "linear-gradient(90deg, #38bdf8, #818cf8)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            FiskAI
          </span>
        </div>

        <div
          style={{
            fontSize: "20px",
            color: "rgba(255, 255, 255, 0.5)",
          }}
        >
          fiskai.hr/vijesti
        </div>
      </div>
    </div>,
    { ...size }
  )
}
