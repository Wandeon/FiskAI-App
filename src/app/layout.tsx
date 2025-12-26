import type { Metadata } from "next"
import { Suspense } from "react"
import { Toaster } from "sonner"
import { AnalyticsProvider } from "@/components/providers/analytics-provider"
import { OfflineIndicator } from "@/components/layout/offline-indicator"
import "./globals.css"

export const metadata: Metadata = {
  title: "FiskAI",
  description: "AI-powered e-invoicing platform",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="hr" className="dark">
      <body>
        <a href="#glavni-sadrzaj" className="skip-link">
          Preskoči na sadržaj
        </a>
        <OfflineIndicator />
        <Toaster
          position="top-right"
          richColors
          closeButton
          expand
          toastOptions={{
            className: "font-sans rounded-card shadow-elevated",
            duration: 4000,
            style: {
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            },
          }}
        />
        <Suspense fallback={null}>
          <AnalyticsProvider>
            <main id="glavni-sadrzaj">{children}</main>
          </AnalyticsProvider>
        </Suspense>
      </body>
    </html>
  )
}
