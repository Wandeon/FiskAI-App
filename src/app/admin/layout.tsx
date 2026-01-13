import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { AdminSidebar } from "@/components/admin/sidebar"
import { AdminHeaderWrapper } from "@/components/admin/admin-header-wrapper"
import { AdminSkipLinks } from "@/components/a11y/skip-link"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect("/auth")
  }

  if (session.user.systemRole !== "ADMIN") {
    redirect("/")
  }

  return (
    <div className="flex h-screen bg-[var(--background)]">
      <AdminSkipLinks />
      <AdminSidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeaderWrapper />

        {/* Main content area */}
        <main id="main-content" className="flex-1 overflow-auto p-6" tabIndex={-1}>
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
