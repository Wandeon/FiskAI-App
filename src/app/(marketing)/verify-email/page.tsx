import type { Metadata } from "next"

const APP_URL = "https://app.fiskai.hr"

export const metadata: Metadata = {
  title: "Potvrda emaila - FiskAI",
  description: "Preusmjeravanje na potvrdu emaila...",
  robots: { index: false, follow: false },
}

/**
 * Static redirect stub for /verify-email
 * The actual verify-email functionality lives at app.fiskai.hr/verify-email
 * This page exists only to preserve the URL and redirect users.
 */
export default function VerifyEmailRedirect() {
  const redirectUrl = `${APP_URL}/verify-email`

  return (
    <html lang="hr">
      <head>
        <meta httpEquiv="refresh" content={`0;url=${redirectUrl}`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.location.replace("${redirectUrl}");`,
          }}
        />
      </head>
      <body className="min-h-screen flex items-center justify-center bg-surface-1">
        <div className="text-center p-8">
          <p className="text-secondary mb-4">Preusmjeravanje na aplikaciju...</p>
          <a href={redirectUrl} className="text-link hover:underline">
            Kliknite ovdje ako se stranica ne učita automatski
          </a>
        </div>
      </body>
    </html>
  )
}
