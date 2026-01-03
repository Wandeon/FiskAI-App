// src/app/(app)/page.tsx
/**
 * App Portal Root Page
 *
 * Redirects authenticated users to Control Center.
 * Unauthenticated users are redirected to login.
 *
 * @since Control Center Routing - Phase 1
 */

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function AppRootPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }
  redirect("/control-center")
}
