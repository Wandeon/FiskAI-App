"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, RefreshCw, CheckCircle } from "lucide-react"
import { resendVerificationEmail } from "@/app/actions/auth"

export default function CheckEmailPage() {
  const searchParams = useSearchParams()
  const email = searchParams.get("email") || ""
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [cooldown])

  async function handleResend() {
    if (cooldown > 0 || resending || !email) return

    setResending(true)
    setError(null)
    setResent(false)

    const result = await resendVerificationEmail(email)

    setResending(false)

    if (result?.error === "rate_limited") {
      setError("Previše pokušaja. Molimo pričekajte prije ponovnog slanja.")
      setCooldown(60)
    } else if (result?.success) {
      setResent(true)
      setCooldown(60) // 60 second cooldown between resends
    }
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-info-bg">
          <Mail className="h-8 w-8 text-link" />
        </div>
        <CardTitle className="text-2xl">Provjerite svoj email</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-secondary">Poslali smo vam 6-znamenkasti kod za potvrdu na:</p>
        <p className="font-medium text-lg break-all">{email}</p>
        <p className="text-sm text-secondary">
          Unesite kod u obrascu za registraciju kako biste potvrdili svoju adresu i aktivirali
          račun.
        </p>

        <div className="rounded-md bg-warning-bg border border-warning-border p-4 text-left">
          <p className="text-sm text-warning-text">
            <strong>Ne vidite email?</strong>
            <br />
            Provjerite spam/neželjenu poštu. Kod vrijedi 10 minuta.
          </p>
        </div>

        {resent && (
          <div className="flex items-center justify-center gap-2 text-success-text">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm">Email je ponovno poslan!</span>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-danger-bg p-3 text-sm text-danger-text">{error}</div>
        )}

        <Button
          variant="outline"
          className="w-full"
          onClick={handleResend}
          disabled={resending || cooldown > 0 || !email}
        >
          {resending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Slanje...
            </>
          ) : cooldown > 0 ? (
            `Pošalji ponovno (${cooldown}s)`
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Pošalji ponovno
            </>
          )}
        </Button>

        <p className="text-sm text-secondary">
          Pogrešan email?{" "}
          <Link href="/register" className="text-link hover:underline">
            Registrirajte se ponovno
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
