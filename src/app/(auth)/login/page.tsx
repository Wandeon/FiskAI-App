"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, LoginInput } from "@/lib/validations"
import { login, loginWithPasskey, resendVerificationEmail } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { startAuthentication } from "@simplewebauthn/browser"
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser"
import { Chrome, KeyRound, Mail, CheckCircle, RefreshCw, Loader2 } from "lucide-react"
import { toast } from "@/lib/toast"
import { getProviders, signIn } from "next-auth/react"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [isPasskeySupported, setIsPasskeySupported] = useState(false)
  const [showPasskeyEmail, setShowPasskeyEmail] = useState(false)
  const [passkeyEmail, setPasskeyEmail] = useState("")
  const [googleAvailable, setGoogleAvailable] = useState(false)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [justVerified, setJustVerified] = useState(false)

  useEffect(() => {
    // Check if user just verified their email
    if (searchParams.get("verified") === "true") {
      setJustVerified(true)
    }
  }, [searchParams])

  useEffect(() => {
    setIsPasskeySupported(
      typeof window !== "undefined" &&
        window?.PublicKeyCredential !== undefined &&
        navigator?.credentials !== undefined
    )
  }, [])

  useEffect(() => {
    getProviders()
      .then((providers) => {
        setGoogleAvailable(!!providers?.google)
      })
      .catch(() => {
        setGoogleAvailable(false)
      })
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginInput) {
    setLoading(true)
    setError(null)
    setUnverifiedEmail(null)
    setResent(false)
    setJustVerified(false)

    const result = await login(data)

    if (result?.error) {
      if (result.error === "email_not_verified" && result.email) {
        setUnverifiedEmail(result.email)
        setError(null)
      } else {
        setError(result.error)
      }
      setLoading(false)
    }
  }

  async function handleResendVerification() {
    if (!unverifiedEmail || resending) return

    setResending(true)
    const result = await resendVerificationEmail(unverifiedEmail)
    setResending(false)

    if (result?.success) {
      setResent(true)
    } else if (result?.error === "rate_limited") {
      setError("Previše pokušaja. Molimo pričekajte prije ponovnog slanja.")
    }
  }

  async function handlePasskeyLogin() {
    if (!passkeyEmail) {
      setError("Molimo unesite email adresu")
      return
    }

    setPasskeyLoading(true)
    setError(null)

    try {
      const startResponse = await fetch("/api/webauthn/login/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: passkeyEmail }),
      })

      if (!startResponse.ok) {
        const data = await startResponse.json()
        throw new Error(data.error || "Failed to start authentication")
      }

      const { userId, ...options } = await startResponse.json()
      const authResponse = await startAuthentication({
        optionsJSON: options as PublicKeyCredentialRequestOptionsJSON,
      })

      const finishResponse = await fetch("/api/webauthn/login/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, response: authResponse }),
      })

      if (!finishResponse.ok) {
        throw new Error("Failed to verify authentication")
      }

      const finishData = await finishResponse.json()

      // Create actual session using server action
      const sessionResult = await loginWithPasskey(finishData.user.id)
      if (sessionResult?.error) {
        throw new Error(sessionResult.error)
      }

      toast.success("Uspjesna prijava!")
      router.push("/dashboard")
      router.refresh()
    } catch (error) {
      console.error("Passkey login error:", error)
      if (error instanceof Error && error.name === "NotAllowedError") {
        setError("Prijava otkazana")
      } else if (error instanceof Error) {
        setError(error.message)
      } else {
        setError("Greska prilikom prijave s passkey")
      }
    } finally {
      setPasskeyLoading(false)
    }
  }

  return (
    <div className="relative">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Prijava u FiskAI</CardTitle>
        </CardHeader>
        <CardContent>
          <div key={showPasskeyEmail ? "passkey" : "password"} className="animate-slide-up">
            {showPasskeyEmail ? (
              <div className="space-y-4">
                {error && (
                  <div
                    role="alert"
                    className="animate-slide-down rounded-md bg-red-50 p-3 text-sm text-red-600"
                  >
                    {error}
                  </div>
                )}
                <div className="space-y-2">
                  <label htmlFor="passkey-email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="passkey-email"
                    type="email"
                    placeholder="vas@email.com"
                    value={passkeyEmail}
                    onChange={(e) => setPasskeyEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handlePasskeyLogin()
                      }
                    }}
                  />
                </div>
                <Button onClick={handlePasskeyLogin} className="w-full" disabled={passkeyLoading}>
                  {passkeyLoading ? "Prijava..." : "Nastavi s passkey"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setShowPasskeyEmail(false)
                    setPasskeyEmail("")
                    setError(null)
                  }}
                >
                  Povratak na prijavu s lozinkom
                </Button>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {justVerified && (
                    <div
                      role="alert"
                      className="animate-slide-down rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-center gap-2"
                    >
                      <CheckCircle className="h-4 w-4 flex-shrink-0" />
                      <span>Email potvrđen! Sada se možete prijaviti.</span>
                    </div>
                  )}

                  {unverifiedEmail && (
                    <div
                      role="alert"
                      className="animate-slide-down rounded-md bg-amber-50 border border-amber-200 p-4 text-sm"
                    >
                      <div className="flex items-start gap-3">
                        <Mail className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-2 flex-1">
                          <p className="text-amber-800 font-medium">
                            Molimo potvrdite svoju email adresu
                          </p>
                          <p className="text-amber-700">
                            Poslali smo vam link za potvrdu na {unverifiedEmail}. Provjerite inbox i
                            spam folder.
                          </p>
                          {resent ? (
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle className="h-4 w-4" />
                              <span>Novi link je poslan!</span>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleResendVerification}
                              disabled={resending}
                              className="mt-1"
                            >
                              {resending ? (
                                <>
                                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                  Slanje...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="mr-2 h-3 w-3" />
                                  Pošalji ponovno
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div
                      role="alert"
                      className="animate-slide-down rounded-md bg-red-50 p-3 text-sm text-red-600"
                    >
                      {error}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium">
                      Email
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="vas@email.com"
                      error={errors.email?.message}
                      {...register("email")}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium">
                      Lozinka
                    </label>
                    <Input
                      id="password"
                      type="password"
                      error={errors.password?.message}
                      {...register("password")}
                    />
                  </div>
                  <div className="text-right">
                    <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                      Zaboravljena lozinka?
                    </Link>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Prijava..." : "Prijavi se"}
                  </Button>
                </form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--border)]" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-2 text-[var(--muted)]">ili</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {googleAvailable && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full flex items-center gap-2"
                      onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                    >
                      <Chrome className="h-4 w-4" />
                      Nastavi s Google
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full flex items-center gap-2"
                    onClick={() => setShowPasskeyEmail(true)}
                    disabled={!isPasskeySupported}
                  >
                    <KeyRound className="h-4 w-4" />
                    Prijava s passkey
                  </Button>
                </div>

                <p className="mt-4 text-center text-sm text-gray-600">
                  Nemate račun?{" "}
                  <Link href="/register" className="text-blue-600 hover:underline">
                    Registrirajte se
                  </Link>
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
