// src/app/(admin)/page.tsx
/**
 * Admin Portal Root Page
 *
 * Redirects authenticated admin users to Control Center.
 * Unauthenticated users are redirected to login.
 *
 * @since Control Center Routing - Phase 1
 */

import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export default async function AdminRootPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }
  redirect("/control-center")
}
