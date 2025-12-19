import Link from "next/link"
import { Logo } from "@/components/ui/Logo"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen">
      {/* Minimal header - just logo */}
      <header className="fixed left-0 right-0 top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex h-16 items-center">
            <Link href="/">
              <Logo size="sm" variant="white" />
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      {children}
    </div>
  )
}
