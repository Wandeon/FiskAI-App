import { redirect } from "next/navigation"
import { getAuthUrl } from "@/lib/portal-urls"

export default function RegisterRedirectPage() {
  // Redirect to app.fiskai.hr/auth (auth page handles both login/register)
  redirect(getAuthUrl())
}
