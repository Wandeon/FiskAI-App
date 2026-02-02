// src/app/api/auth/dev-login/route.ts
// Dev-only login endpoint - bypasses password for local development
// SECURITY: Only works when NODE_ENV !== "production"
//
// This endpoint generates a login token and returns a page that auto-submits
// the credentials form, triggering the normal NextAuth flow.

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { generateLoginToken } from "@/lib/auth/login-token"

const DEFAULT_DEV_EMAIL = "test@fiskai.hr"

export async function GET(request: NextRequest) {
  // CRITICAL: Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 })
  }

  // Optional secret check for extra safety
  const secret = request.nextUrl.searchParams.get("secret")
  if (process.env.DEV_LOGIN_SECRET && secret !== process.env.DEV_LOGIN_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 })
  }

  // Allow specifying email via query param: /api/auth/dev-login?email=user@example.com
  const email = request.nextUrl.searchParams.get("email") || DEFAULT_DEV_EMAIL

  try {
    // Find existing user
    const user = await db.user.findUnique({
      where: { email },
      include: {
        companies: {
          where: { isDefault: true },
          include: { company: true },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: `User not found: ${email}` }, { status: 404 })
    }

    // Check if user has a company - if not, they'll be redirected to onboarding after login
    const hasCompany = user.companies.length > 0

    // Generate a login token that the credentials provider will accept
    const loginToken = await generateLoginToken({
      userId: user.id,
      email: user.email,
      type: "otp", // Reuse the OTP flow since it's already supported
    })

    // Redirect URL
    const callbackUrl = request.nextUrl.searchParams.get("callbackUrl") || "/dashboard"

    // Return an HTML page that fetches CSRF token client-side then submits
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Dev Login - Redirecting...</title>
</head>
<body>
  <p>Logging in as ${user.email}...</p>
  <form id="loginForm" method="POST" action="/api/auth/callback/credentials">
    <input type="hidden" name="csrfToken" id="csrfToken" value="" />
    <input type="hidden" name="email" value="${user.email}" />
    <input type="hidden" name="password" value="${loginToken}" />
    <input type="hidden" name="callbackUrl" value="${callbackUrl}" />
  </form>
  <script>
    fetch('/api/auth/csrf')
      .then(r => r.json())
      .then(data => {
        document.getElementById('csrfToken').value = data.csrfToken;
        document.getElementById('loginForm').submit();
      });
  </script>
</body>
</html>
`

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    })
  } catch (error) {
    console.error("Dev login error:", error)
    return NextResponse.json({ error: "Dev login failed", details: String(error) }, { status: 500 })
  }
}
