import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { StaffSidebar } from "@/components/staff/sidebar"
import { StaffHeader } from "@/components/staff/header"
import { StaffClientProvider } from "@/components/staff/staff-client-provider"

export default async function StaffLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect("/auth")
  }

  // Check for STAFF or ADMIN role
  if (session.user.systemRole !== "STAFF" && session.user.systemRole !== "ADMIN") {
    redirect("/")
  }

  return (
    <StaffClientProvider>
      <div className="flex h-screen bg-[var(--background)]">
        <StaffSidebar />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <StaffHeader />

          {/* Main content area */}
          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </StaffClientProvider>
  )
}
