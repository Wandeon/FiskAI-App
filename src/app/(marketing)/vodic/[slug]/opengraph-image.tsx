import { ImageResponse } from "next/og"
import fs from "fs"
import path from "path"
import matter from "gray-matter"

export const runtime = "nodejs" // Need node runtime for file system access
export const alt = "FiskAI Vodič"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

interface Props {
  params: Promise<{ slug: string }>
}

async function getGuideData(slug: string) {
  try {
    const guidePath = path.join(process.cwd(), "content", "vodici", `${slug}.mdx`)
    const fileContents = fs.readFileSync(guidePath, "utf8")
    const { data } = matter(fileContents)
    return {
      title: data.title || slug,
      description: data.description || "",
    }
  } catch {
    return null
  }
}

export default async function OGImage({ params }: Props) {
  const { slug } = await params
  const guide = await getGuideData(slug)

  if (!guide) {
    return new ImageResponse(
      (
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
          FiskAI Vodič
        </div>
      ),
      { ...size }
    )
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0f172a",
          backgroundImage:
            "radial-gradient(circle at 0% 0%, rgba(34, 197, 94, 0.15) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(56, 189, 248, 0.15) 0%, transparent 50%)",
          padding: "60px",
        }}
      >
        {/* Type badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              padding: "8px 20px",
              borderRadius: "999px",
              background: "rgba(34, 197, 94, 0.2)",
              border: "1px solid rgba(34, 197, 94, 0.5)",
              fontSize: "18px",
              color: "#86efac",
            }}
          >
            Vodič
          </div>
          <div
            style={{
              padding: "8px 20px",
              borderRadius: "999px",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              fontSize: "18px",
              color: "rgba(255, 255, 255, 0.8)",
            }}
          >
            Baza znanja
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: "56px",
            fontWeight: "bold",
            color: "white",
            lineHeight: 1.2,
            marginBottom: "24px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {guide.title}
        </div>

        {/* Description */}
        {guide.description && (
          <div
            style={{
              fontSize: "26px",
              color: "rgba(255, 255, 255, 0.7)",
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              marginBottom: "auto",
            }}
          >
            {guide.description}
          </div>
        )}

        {/* Footer */}
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
                background: "linear-gradient(135deg, #22c55e 0%, #38bdf8 100%)",
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
                background: "linear-gradient(90deg, #22c55e, #38bdf8)",
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
            fiskai.hr/vodic
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}
