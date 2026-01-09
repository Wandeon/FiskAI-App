"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle, XCircle, Clock, Loader2, RefreshCw, Info } from "lucide-react"
import { verifyEmail, resendVerificationEmail } from "@/app/actions/auth"

type VerificationState =
  | "loading"
  | "success"
  | "already_verified"
  | "expired"
  | "invalid"
  | "error"
  | "use_otp" // New state for guiding to OTP flow

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
      // No token provided - guide user to use modern OTP flow
      setState("use_otp")
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

    void verify()
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
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-info-bg">
              <Loader2 className="h-8 w-8 text-link animate-spin" />
            </div>
            <CardTitle className="text-2xl">Potvrda email adrese</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-secondary">Provjeravamo vaš link...</p>
          </CardContent>
        </>
      )}

      {state === "success" && (
        <>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-bg">
              <CheckCircle className="h-8 w-8 text-success-text" />
            </div>
            <CardTitle className="text-2xl">Email potvrđen!</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-secondary">
              Vaša email adresa je uspješno potvrđena. Možete se sada prijaviti.
            </p>
            <p className="text-sm text-secondary">Preusmjeravanje na prijavu...</p>
            <Button asChild className="w-full">
              <Link href="/login">Prijavi se</Link>
            </Button>
          </CardContent>
        </>
      )}

      {state === "already_verified" && (
        <>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success-bg">
              <CheckCircle className="h-8 w-8 text-success-text" />
            </div>
            <CardTitle className="text-2xl">Već potvrđeno</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-secondary">
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
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning-bg">
              <Clock className="h-8 w-8 text-warning-text" />
            </div>
            <CardTitle className="text-2xl">Link je istekao</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-secondary">
              Ovaj link za potvrdu je istekao. Novi kod za potvrdu će biti poslan na vaš email.
            </p>
            <div className="rounded-md bg-info-bg p-3 text-sm text-info-text flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p className="text-left">
                Sada koristimo 6-znamenkaste kodove umjesto linkova za potvrdu. Unesite kod koji ste
                primili na email.
              </p>
            </div>

            {expiredEmail ? (
              <>
                {resent && (
                  <div className="flex items-center justify-center gap-2 text-success-text">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">Novi kod je poslan na {expiredEmail}</span>
                  </div>
                )}
                {resendError && (
                  <div className="rounded-md bg-danger-bg p-3 text-sm text-danger-text">
                    {resendError}
                  </div>
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
                      Pošalji novi kod
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
                  <div className="flex items-center justify-center gap-2 text-success-text">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">Novi kod je poslan!</span>
                  </div>
                )}
                {resendError && (
                  <div className="rounded-md bg-danger-bg p-3 text-sm text-danger-text">
                    {resendError}
                  </div>
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
                      Pošalji novi kod
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
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger-bg">
              <XCircle className="h-8 w-8 text-danger-text" />
            </div>
            <CardTitle className="text-2xl">
              {state === "invalid" ? "Nevažeći link" : "Došlo je do greške"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-secondary">
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

      {state === "use_otp" && (
        <>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-info-bg">
              <Info className="h-8 w-8 text-link" />
            </div>
            <CardTitle className="text-2xl">Koristite 6-znamenkasti kod</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-secondary">
              Email verifikacija sada koristi 6-znamenkaste kodove umjesto linkova.
            </p>
            <div className="rounded-md bg-info-bg p-4 text-left space-y-2">
              <p className="text-sm text-info-text font-medium">Kako potvrditi email:</p>
              <ol className="text-sm text-info-text list-decimal list-inside space-y-1">
                <li>Provjerite vaš email sandučić</li>
                <li>Potražite 6-znamenkasti kod od FiskAI</li>
                <li>Unesite kod tijekom registracije ili prijave</li>
              </ol>
            </div>
            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link href="/register">Započni registraciju</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Ili se prijavi</Link>
              </Button>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  )
}
