import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import { Suspense } from "react"
import { Toaster } from "sonner"
import { AnalyticsProvider } from "@/components/providers/analytics-provider"
import { OfflineIndicator } from "@/components/layout/offline-indicator"
import { JsonLd } from "@/components/seo/JsonLd"
import {
  generateOrganizationSchema,
  generateWebSiteSchema,
  generateSoftwareApplicationSchema,
} from "@/lib/schema/generators"
import "./globals.css"

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
})

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
}

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "FiskAI - AI-powered E-fakturiranje i Fiskalizacija",
    template: "%s | FiskAI",
  },
  description:
    "AI-powered platforma za e-fakturiranje i fiskalizaciju za hrvatska poduzeća. Automatizirano knjigovodstvo, porezna usklađenost i pametni savjetnik.",
  keywords: [
    "e-fakturiranje",
    "fiskalizacija",
    "e-račun",
    "AI knjigovodstvo",
    "fakturiranje hrvatska",
    "porezna usklađenost",
    "obrt",
    "d.o.o.",
    "paušalni obrt",
    "računovodstvo",
  ],
  authors: [{ name: "FiskAI", url: BASE_URL }],
  creator: "FiskAI",
  publisher: "FiskAI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    // Apple touch icon uses the 192px icon (iOS will resize to 180px)
    apple: [{ url: "/icon-192.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    locale: "hr_HR",
    alternateLocale: "en_US",
    url: BASE_URL,
    siteName: "FiskAI",
    title: "FiskAI - AI-powered E-fakturiranje i Fiskalizacija",
    description:
      "AI-powered platforma za e-fakturiranje i fiskalizaciju za hrvatska poduzeća. Automatizirano knjigovodstvo, porezna usklađenost i pametni savjetnik.",
    // Note: Dynamic OG image is auto-generated from opengraph-image.tsx
    // Next.js will automatically serve it at /opengraph-image
    images: [
      {
        url: `${BASE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "FiskAI - AI-powered E-fakturiranje",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@fiskai_hr",
    creator: "@fiskai_hr",
    title: "FiskAI - AI-powered E-fakturiranje i Fiskalizacija",
    description: "AI-powered platforma za e-fakturiranje i fiskalizaciju za hrvatska poduzeća.",
    images: [`${BASE_URL}/opengraph-image`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
    languages: {
      "hr-HR": BASE_URL,
      "en-US": `${BASE_URL}/en`,
      "x-default": BASE_URL,
    },
    types: {
      "application/rss+xml": `${BASE_URL}/feed.xml`,
    },
  },
  category: "business",
  verification: {
    // Add your verification tokens here
    // google: "your-google-verification-token",
    // yandex: "your-yandex-verification-token",
    // bing: "your-bing-verification-token",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="hr" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <head>
        {/* Resource hints: Preconnect to third-party origins for faster connection establishment */}
        <link rel="preconnect" href="https://eu.posthog.com" crossOrigin="anonymous" />
        <link
          rel="preconnect"
          href="https://o4509363207012352.ingest.de.sentry.io"
          crossOrigin="anonymous"
        />

        {/* Enterprise SEO: Organization, WebSite, and SoftwareApplication schemas */}
        <JsonLd
          schemas={[
            generateOrganizationSchema(),
            generateWebSiteSchema(),
            generateSoftwareApplicationSchema(),
          ]}
        />
      </head>
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
