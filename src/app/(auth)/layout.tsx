import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "FiskAI - Prijava",
  description: "Prijavite se u FiskAI sustav",
}

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // Force dark mode for auth page - the glassmorphic design requires dark background
    <div className="dark min-h-screen bg-base font-sans antialiased">
      {/* AuthFlow handles its own full-page design. Keeping this layout minimal. */}
      {children}
    </div>
  )
}
