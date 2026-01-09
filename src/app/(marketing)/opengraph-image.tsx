/* eslint-disable fisk-design-system/no-hardcoded-colors -- OG image generation uses inline styles for PNG output */
import { ImageResponse } from "next/og"

// Use nodejs runtime for static export compatibility
export const runtime = "nodejs"
export const alt = "FiskAI - AI-powered E-fakturiranje i Fiskalizacija"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default async function OGImage() {
  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0f172a",
        backgroundImage:
          "radial-gradient(circle at 25% 25%, rgba(56, 189, 248, 0.15) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)",
      }}
    >
      {/* Logo and Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          marginBottom: "40px",
        }}
      >
        {/* Simple Logo Icon */}
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "20px",
            background: "linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "40px",
            fontWeight: "bold",
            color: "white",
          }}
        >
          F
        </div>
        <span
          style={{
            fontSize: "60px",
            fontWeight: "bold",
            background: "linear-gradient(90deg, #38bdf8, #818cf8)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          FiskAI
        </span>
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: "36px",
          fontWeight: "600",
          color: "white",
          textAlign: "center",
          maxWidth: "900px",
          marginBottom: "20px",
        }}
      >
        AI-powered E-fakturiranje i Fiskalizacija
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: "24px",
          color: "rgba(255, 255, 255, 0.7)",
          textAlign: "center",
          maxWidth: "800px",
        }}
      >
        Automatizirano knjigovodstvo za hrvatska poduzeća
      </div>

      {/* Feature Pills */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          marginTop: "40px",
        }}
      >
        {["E-računi", "Fiskalizacija", "AI Savjetnik", "Porezna usklađenost"].map((feature) => (
          <div
            key={feature}
            style={{
              padding: "12px 24px",
              borderRadius: "999px",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              fontSize: "18px",
              color: "rgba(255, 255, 255, 0.9)",
            }}
          >
            {feature}
          </div>
        ))}
      </div>

      {/* URL */}
      <div
        style={{
          position: "absolute",
          bottom: "40px",
          fontSize: "20px",
          color: "rgba(255, 255, 255, 0.5)",
        }}
      >
        fiskai.hr
      </div>
    </div>,
    {
      ...size,
    }
  )
}
