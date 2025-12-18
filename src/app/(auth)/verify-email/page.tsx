"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle, XCircle, Clock, Loader2, RefreshCw } from "lucide-react"
import { verifyEmail, resendVerificationEmail } from "@/app/actions/auth"

type VerificationState =
  | "loading"
  | "success"
  | "already_verified"
  | "expired"
  | "invalid"
  | "error"

export default function VerifyEmailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [state, setState] = useState<VerificationState>("loading")
  const [expiredEmail, setExpiredEmail] = useState<string>("")
  const [resendEmail, setResendEmail] = useState("")
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [resendError, setResendError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setState("invalid")
      return
    }

    async function verify() {
      const result = await verifyEmail(token!)

      if (result?.success) {
        if (result.alreadyVerified) {
          setState("already_verified")
        } else {
          setState("success")
        }
        // Auto-redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/login?verified=true")
        }, 3000)
      } else if (result?.error === "token_expired") {
        setState("expired")
        if (result.email) {
          setExpiredEmail(result.email)
          setResendEmail(result.email)
        }
      } else if (result?.error === "invalid_token" || result?.error === "user_not_found") {
        setState("invalid")
      } else {
        setState("error")
      }
    }

    verify()
  }, [token, router])

  async function handleResend() {
    const emailToUse = resendEmail || expiredEmail
    if (!emailToUse || resending) return

    setResending(true)
    setResendError(null)
    setResent(false)

    const result = await resendVerificationEmail(emailToUse)

    setResending(false)

    if (result?.error === "rate_limited") {
      setResendError("Previše pokušaja. Molimo pričekajte prije ponovnog slanja.")
    } else if (result?.success) {
      setResent(true)
    }
  }

  return (
    <Card className="max-w-md mx-auto">
      {state === "loading" && (
        <>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
            <CardTitle className="text-2xl">Potvrda email adrese</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600">Provjeravamo vaš link...</p>
          </CardContent>
        </>
      )}

      {state === "success" && (
        <>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Email potvrđen!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Vaša email adresa je uspješno potvrđena. Možete se sada prijaviti.
            </p>
            <p className="text-sm text-gray-500">Preusmjeravanje na prijavu...</p>
            <Button asChild className="w-full">
              <Link href="/login">Prijavi se</Link>
            </Button>
          </CardContent>
        </>
      )}

      {state === "already_verified" && (
        <>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Već potvrđeno</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Vaša email adresa je već potvrđena. Možete se prijaviti.
            </p>
            <Button asChild className="w-full">
              <Link href="/login">Prijavi se</Link>
            </Button>
          </CardContent>
        </>
      )}

      {state === "expired" && (
        <>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <CardTitle className="text-2xl">Link je istekao</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">Ovaj link za potvrdu je istekao. Zatražite novi link.</p>

            {expiredEmail ? (
              <>
                {resent && (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">Novi link je poslan na {expiredEmail}</span>
                  </div>
                )}
                {resendError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{resendError}</div>
                )}
                <Button className="w-full" onClick={handleResend} disabled={resending || resent}>
                  {resending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Slanje...
                    </>
                  ) : resent ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Poslano!
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Pošalji novi link
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="space-y-2">
                <Input
                  type="email"
                  placeholder="Unesite vaš email"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                />
                {resent && (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">Novi link je poslan!</span>
                  </div>
                )}
                {resendError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{resendError}</div>
                )}
                <Button
                  className="w-full"
                  onClick={handleResend}
                  disabled={resending || !resendEmail || resent}
                >
                  {resending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Slanje...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Pošalji novi link
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </>
      )}

      {(state === "invalid" || state === "error") && (
        <>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl">
              {state === "invalid" ? "Nevažeći link" : "Došlo je do greške"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              {state === "invalid"
                ? "Ovaj link za potvrdu nije valjan. Možda je korišten ili je neispravan."
                : "Došlo je do greške prilikom potvrde. Molimo pokušajte ponovno."}
            </p>
            <div className="space-y-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/register">Registriraj se ponovno</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/login">Prijavi se</Link>
              </Button>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  )
}
