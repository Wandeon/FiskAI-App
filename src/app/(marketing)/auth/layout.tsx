import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {/* Minimal header - just logo */}
      <header className="fixed left-0 right-0 top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex h-16 items-center">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="text-lg font-bold tracking-tight text-white drop-shadow-lg">
                FiskAI
              </span>
              <span className="rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm">
                beta
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      {children}
    </div>
  )
}
