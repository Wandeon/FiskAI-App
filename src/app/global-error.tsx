/* eslint-disable fisk-design-system/no-hardcoded-colors -- @design-override: Global error boundary uses inline styles because CSS may not load during critical errors */
"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to Sentry for monitoring
    Sentry.captureException(error)

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Global error boundary caught:", error)
      console.error("Stack trace:", error.stack)
    }
  }, [error])

  return (
    <html lang="hr">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#f9fafb",
            padding: "1rem",
          }}
        >
          <div
            style={{
              maxWidth: "28rem",
              textAlign: "center",
            }}
          >
            <div
              style={{
                marginBottom: "1.5rem",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "4rem",
                  height: "4rem",
                  borderRadius: "9999px",
                  backgroundColor: "#fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
            </div>

            <h1
              style={{
                marginBottom: "1rem",
                fontSize: "1.5rem",
                fontWeight: "700",
                color: "#111827",
              }}
            >
              Došlo je do kritične greške
            </h1>

            <p
              style={{
                marginBottom: "1.5rem",
                fontSize: "1rem",
                color: "#6b7280",
              }}
            >
              Nažalost, došlo je do neočekivane greške. Naš tim je automatski obaviješten i radimo
              na rješenju.
            </p>

            {process.env.NODE_ENV === "development" && error.message && (
              <div
                style={{
                  marginBottom: "1.5rem",
                  padding: "1rem",
                  backgroundColor: "#f3f4f6",
                  borderRadius: "0.5rem",
                  textAlign: "left",
                }}
              >
                <p
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    color: "#111827",
                    marginBottom: "0.5rem",
                  }}
                >
                  Development Mode - Error Details:
                </p>
                <p
                  style={{
                    fontSize: "0.75rem",
                    color: "#374151",
                    wordBreak: "break-word",
                  }}
                >
                  <strong>Message:</strong> {error.message}
                </p>
                {error.digest && (
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "#374151",
                      marginTop: "0.5rem",
                    }}
                  >
                    <strong>Digest:</strong> {error.digest}
                  </p>
                )}
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              <button
                onClick={() => reset()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "#2563eb",
                  padding: "0.75rem 1.5rem",
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#1d4ed8"
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "#2563eb"
                }}
              >
                Pokušaj ponovo
              </button>

              <button
                onClick={() => (window.location.href = "/")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "white",
                  border: "1px solid #d1d5db",
                  padding: "0.75rem 1.5rem",
                  fontSize: "0.875rem",
                  fontWeight: "600",
                  color: "#374151",
                  cursor: "pointer",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = "#f9fafb"
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = "white"
                }}
              >
                Natrag na početnu
              </button>
            </div>

            <div style={{ marginTop: "1.5rem" }}>
              <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                Ako se problem nastavi, molimo{" "}
                <button
                  onClick={() => (window.location.href = "/kontakt")}
                  style={{
                    fontWeight: "500",
                    color: "#2563eb",
                    textDecoration: "none",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    font: "inherit",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.textDecoration = "underline"
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.textDecoration = "none"
                  }}
                >
                  kontaktirajte našu podršku
                </button>
                .
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
