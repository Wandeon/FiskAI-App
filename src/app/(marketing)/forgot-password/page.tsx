import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Zaboravljena lozinka | FiskAI",
  robots: "noindex, nofollow", // Don't index redirect pages
}

export default function ForgotPasswordRedirectPage() {
  return (
    <>
      {/* Meta refresh - works on all browsers/hosts */}
      <meta httpEquiv="refresh" content="0;url=https://app.fiskai.hr/forgot-password" />

      {/* JavaScript redirect - immediate fallback */}
      <script
        dangerouslySetInnerHTML={{
          __html: `window.location.replace("https://app.fiskai.hr/forgot-password");`,
        }}
      />

      {/* Visible fallback with link */}
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <p className="mb-4">Preusmjeravanje...</p>
          <a
            href="https://app.fiskai.hr/forgot-password"
            className="text-link underline hover:text-link"
          >
            Kliknite ovdje ako niste automatski preusmjereni
          </a>
        </div>
      </div>
    </>
  )
}
