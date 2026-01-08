import { redirect } from "next/navigation"
import { getAuthUrl } from "@/lib/portal-urls"

export default function LoginRedirectPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string }
}) {
  // Redirect to app.fiskai.hr/auth preserving callbackUrl
  const authUrl = getAuthUrl()
  const url = new URL(authUrl)
  if (searchParams.callbackUrl) {
    url.searchParams.set("callbackUrl", searchParams.callbackUrl)
  }
  redirect(url.toString())
}
