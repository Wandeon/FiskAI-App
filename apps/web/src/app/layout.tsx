import type { Metadata } from "next"
import { Providers } from "./providers"
import "./globals.css"

export const metadata: Metadata = {
  title: "FiskAI",
  description: "Croatian e-invoicing made simple",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="hr">
      <body className="antialiased bg-slate-950 text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
