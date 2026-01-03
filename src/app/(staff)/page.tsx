// src/app/(staff)/page.tsx
/**
 * Staff Portal Root Page
 *
 * Redirects authenticated staff users to Control Center.
 * Unauthenticated users are redirected to login.
 *
 * @since Control Center Routing - Phase 1
 */

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function StaffRootPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }
  redirect("/control-center")
}
