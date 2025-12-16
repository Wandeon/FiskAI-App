import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import Link from "next/link"
import { LogOut, Newspaper } from "lucide-react"

const ADMIN_COOKIE = "fiskai_admin_auth"

async function isAdminAuthenticated() {
  const cookieStore = await cookies()
  return cookieStore.get(ADMIN_COOKIE)?.value === "authenticated"
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const isAuth = await isAdminAuthenticated()

  if (!isAuth) {
    redirect("/admin-login")
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Admin</p>
              <h1 className="text-xl font-semibold">Tenant Control Center</h1>
            </div>
            <nav className="flex gap-4">
              <Link
                href="/admin"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-secondary)]"
              >
                Klijenti
              </Link>
              <Link
                href="/admin/vijesti"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-secondary)]"
              >
                <Newspaper className="h-4 w-4" />
                Vijesti
              </Link>
            </nav>
          </div>
          <form action="/api/admin/auth" method="POST">
            <input type="hidden" name="_method" value="DELETE" />
            <button
              type="submit"
              className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-1 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)]"
            >
              <LogOut className="h-3 w-3" />
              Odjava
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">{children}</main>
    </div>
  )
}
