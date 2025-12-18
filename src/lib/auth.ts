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

        // Rate limiting for login attempts
        const identifier = `login_${credentials.email.toLowerCase()}`
        const rateLimitResult = checkRateLimit(identifier, "LOGIN")

        if (!rateLimitResult.allowed) {
          console.log(`Rate limited login attempt for ${credentials.email}`)
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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
  events: {
    async signIn({ user, account }) {
      // Log successful sign in for audit purposes
      console.log(`User ${user.email} signed in via ${account?.provider || "credentials"}`)
    },
    async signOut({ token, session }) {
      // Log sign out for audit purposes
      console.log(`User ${token.email} signed out`)
    },
  },
})
