"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { resetPassword, validatePasswordResetToken } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Lozinka mora imati najmanje 8 znakova"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Lozinke se ne podudaraju",
    path: ["confirmPassword"],
  })

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

const SESSION_STORAGE_KEY = "pwd_reset_session"

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(true)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  })

  // Validate token immediately on page load and convert to session
  useEffect(() => {
    async function validateToken() {
      // Check if we already have a session
      const existingSession = sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (existingSession) {
        setSessionId(existingSession)
        setValidating(false)
        // Clear the URL if token is still present
        if (token) {
          router.replace("/reset-password")
        }
        return
      }

      // If no token in URL and no session, show error
      if (!token) {
        setError("Token nedostaje. Molimo zatražite novo resetiranje lozinke.")
        setValidating(false)
        return
      }

      // Validate the token and get session ID
      try {
        const result = await validatePasswordResetToken(token)

        if (result.error) {
          setError(result.error)
          setValidating(false)
        } else if (result.sessionId) {
          // Store session ID securely in sessionStorage (not localStorage - cleared on tab close)
          sessionStorage.setItem(SESSION_STORAGE_KEY, result.sessionId)
          setSessionId(result.sessionId)
          setValidating(false)
          // Immediately clear the token from URL to prevent leakage
          router.replace("/reset-password")
        }
      } catch (err) {
        console.error("Token validation error:", err)
        setError("Došlo je do greške prilikom validacije tokena")
        setValidating(false)
      }
    }

    validateToken()
  }, [token, router])

  async function onSubmit(data: ResetPasswordInput) {
    if (!sessionId) {
      setError("Sesija je nevažeća. Molimo zatražite novo resetiranje lozinke.")
      return
    }

    setLoading(true)
    setError(null)

    const result = await resetPassword(sessionId, data.password)

    if (result.error) {
      setError(result.error)
      setLoading(false)
      // Clear invalid session
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
      setSessionId(null)
    } else {
      // Success - clear session and redirect to login with success message
      sessionStorage.removeItem(SESSION_STORAGE_KEY)
      router.push("/login?reset=success")
    }
  }

  // Show loading state while validating token
  if (validating) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Validacija...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
              <p className="mt-4 text-sm text-muted-foreground">Validacija tokena u tijeku...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show error state if token validation failed or no session
  if (error || !sessionId) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Nevažeći link</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-danger-bg p-4 text-sm text-danger-text">
            <p className="font-medium">{error || "Token nedostaje ili je nevažeći"}</p>
            <p className="mt-1">Molimo zatražite novo resetiranje lozinke.</p>
          </div>

          <div className="mt-4 text-center">
            <Link href="/forgot-password" className="text-sm text-link hover:underline">
              Zatraži novo resetiranje
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Nova lozinka</CardTitle>
        <CardDescription>Unesite svoju novu lozinku</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-danger-bg p-3 text-sm text-danger-text">{error}</div>
          )}

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">
              Nova lozinka
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Najmanje 8 znakova"
              error={errors.password?.message}
              {...register("password")}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Potvrdite lozinku
            </label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Ponovite lozinku"
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Resetiranje..." : "Resetiraj lozinku"}
          </Button>

          <div className="text-center">
            <Link href="/login" className="text-sm text-secondary hover:text-foreground">
              Povratak na prijavu
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
