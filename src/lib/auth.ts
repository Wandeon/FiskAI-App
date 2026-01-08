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
    signIn: "/auth",
    error: "/auth",
    verifyRequest: "/auth/verify-request",
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        domain: process.env.NODE_ENV === "production" ? ".fiskai.hr" : undefined,
      },
    },
    callbackUrl: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.callback-url"
          : "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        domain: process.env.NODE_ENV === "production" ? ".fiskai.hr" : undefined,
      },
    },
    // Note: csrfToken uses __Host- prefix which CANNOT have domain set (security requirement)
    // We don't override it - Auth.js handles it correctly
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const identifier = `login_${email.toLowerCase()}`
        const rateLimitResult = await checkRateLimit(identifier, "LOGIN")

        if (!rateLimitResult.allowed) {
          console.log(`Rate limited login attempt for ${credentials.email}`)
          return null
        }

        const password = credentials.password as string

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
          return null
        }

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
      if (account?.provider && account.provider !== "credentials") {
        if (user.id) {
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
      const callbackUrl = new URL(url, baseUrl)

      if (
        callbackUrl.pathname.startsWith("/login") ||
        callbackUrl.pathname.startsWith("/register") ||
        callbackUrl.pathname.startsWith("/auth")
      ) {
        return url
      }

      if (url.startsWith(baseUrl)) {
        return url
      }

      return baseUrl
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { systemRole: true },
        })
        token.systemRole = dbUser?.systemRole || "USER"
      }
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
      console.log(`User ${user.email} signed in via ${account?.provider || "credentials"}`)
    },
    async signOut(message) {
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
