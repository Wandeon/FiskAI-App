import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { db } from "@/lib/db"
import { checkRateLimit } from "@/lib/security/rate-limit"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/auth/verify-request", // for password reset
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        domain: process.env.NODE_ENV === "production" ? ".fiskai.hr" : undefined,
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Get client IP address
        const email = credentials.email as string
        const clientIp =
          request.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request.headers?.get("x-real-ip") ||
          "unknown"

        // Rate limiting by IP+email combination (prevents locking out legitimate users)
        const ipEmailIdentifier = `login_${clientIp}_${email.toLowerCase()}`
        const ipEmailRateLimit = await checkRateLimit(ipEmailIdentifier, "LOGIN")

        // Also rate limit by IP only (prevents distributed attacks on same email)
        const ipOnlyIdentifier = `login_ip_${clientIp}`
        const ipOnlyRateLimit = await checkRateLimit(ipOnlyIdentifier, "LOGIN_IP")

        if (!ipEmailRateLimit.allowed || !ipOnlyRateLimit.allowed) {
          console.log(
            `Rate limited login attempt for ${credentials.email} from IP ${clientIp}`,
            {
              ipEmailAllowed: ipEmailRateLimit.allowed,
              ipOnlyAllowed: ipOnlyRateLimit.allowed,
            }
          )
          return null // Don't reveal that account exists
        }

        const password = credentials.password as string

        // Check for passkey authentication
        if (password.startsWith("__PASSKEY__")) {
          const userId = password.replace("__PASSKEY__", "")
          const user = await db.user.findUnique({
            where: { id: userId, email: credentials.email as string },
          })
          if (user) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
            }
          }
          return null
        }

        // Check for OTP verification authentication
        if (password.startsWith("__OTP_VERIFIED__")) {
          const userId = password.replace("__OTP_VERIFIED__", "")
          const user = await db.user.findUnique({
            where: { id: userId, email: credentials.email as string },
          })
          if (user) {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
            }
          }
          return null
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.passwordHash) {
          return null
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash)

        if (!passwordMatch) {
          // The failed attempt is already tracked by checkRateLimit
          return null
        }

        // Reset rate limit on successful login
        // Note: In production, you might want to implement this differently
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Auto-verify email for OAuth providers (Google, etc.)
      if (account?.provider && account.provider !== "credentials") {
        if (user.id) {
          // Check if user exists and needs verification
          const existingUser = await db.user.findUnique({
            where: { id: user.id },
            select: { emailVerified: true },
          })
          if (existingUser && !existingUser.emailVerified) {
            await db.user.update({
              where: { id: user.id },
              data: { emailVerified: new Date() },
            })
          }
        }
      }
      return true
    },
    async redirect({ url, baseUrl }) {
      // Handle callback URLs
      const callbackUrl = new URL(url, baseUrl)

      // If redirecting to login or auth pages, allow it
      if (
        callbackUrl.pathname.startsWith("/login") ||
        callbackUrl.pathname.startsWith("/register") ||
        callbackUrl.pathname.startsWith("/auth")
      ) {
        return url
      }

      // If there's a specific callback URL requested, use it
      if (url.startsWith(baseUrl)) {
        return url
      }

      // Default redirect based on user role will be handled by the default behavior
      return baseUrl
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        // Fetch the full user from the database to get systemRole
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { systemRole: true },
        })
        token.systemRole = dbUser?.systemRole || "USER"
      }
      // On session update, refresh the role
      if (trigger === "update" && token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { systemRole: true },
        })
        token.systemRole = dbUser?.systemRole || "USER"
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.systemRole = (token.systemRole as "USER" | "STAFF" | "ADMIN") || "USER"
      }
      return session
    },
  },
  events: {
    async signIn({ user, account }) {
      // Log successful sign in for audit purposes
      console.log(`User ${user.email} signed in via ${account?.provider || "credentials"}`)
    },
    async signOut(message) {
      // Log sign out for audit purposes
      const email =
        "token" in message
          ? message.token?.email
          : "session" in message
            ? (message.session as { user?: { email?: string } } | null)?.user?.email
            : "unknown"
      console.log(`User ${email} signed out`)
    },
  },
})
