"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

const registerSchema = z
  .object({
    name: z.string().min(2, "Ime mora imati najmanje 2 znaka"),
    password: z.string().min(8, "Lozinka mora imati najmanje 8 znakova"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Lozinke se ne podudaraju",
    path: ["confirmPassword"],
  })

type RegisterInput = z.infer<typeof registerSchema>

interface InvitationData {
  id: string
  email: string
  companyName?: string
  message?: string
  staff: {
    name: string
    email: string
  }
  expiresAt: string
}

export default function AcceptInvitationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [invitation, setInvitation] = useState<InvitationData | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  // Verify the invitation token on mount
  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setError("Token nedostaje. Molimo zatražite novi poziv od vašeg računovođe.")
        setVerifying(false)
        return
      }

      try {
        const response = await fetch(`/api/invitations/verify?token=${token}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || "Nevažeći ili istekli poziv")
          setVerifying(false)
          return
        }

        setInvitation(data)
        setVerifying(false)
      } catch (err) {
        setError("Greška prilikom provjere poziva. Pokušajte ponovno.")
        setVerifying(false)
      }
    }

    verifyToken()
  }, [token])

  async function onSubmit(data: RegisterInput) {
    if (!token) {
      setError("Token nedostaje")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: data.name,
          password: data.password,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        setError(result.error || "Greška prilikom prihvaćanja poziva")
        setLoading(false)
        return
      }

      // Success - redirect to login
      router.push("/login?invitation=accepted")
    } catch (err) {
      setError("Greška prilikom prihvaćanja poziva. Pokušajte ponovno.")
      setLoading(false)
    }
  }

  // Verifying state
  if (verifying) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Provjeravam poziv...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state (invalid/expired token)
  if (error && !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger-bg">
              <XCircle className="h-10 w-10 text-danger-text" />
            </div>
            <CardTitle className="text-2xl">Nevažeći poziv</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-danger-bg p-4 text-sm text-danger-text">
              <p className="font-medium">{error}</p>
              <p className="mt-1">Molimo kontaktirajte vašeg računovođu za novi poziv.</p>
            </div>

            <div className="mt-6 text-center">
              <Link href="/" className="text-sm text-link hover:underline">
                Povratak na početnu
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Registration form
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
            <CheckCircle className="h-10 w-10 text-indigo-600" />
          </div>
          <CardTitle className="text-2xl">Dobrodošli u FiskAI</CardTitle>
          <CardDescription>
            {invitation?.staff.name} vas poziva da se pridružite platformi
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Invitation details */}
          <div className="mb-6 rounded-lg bg-indigo-50 p-4">
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-indigo-900">Email:</span>{" "}
                <span className="text-indigo-700">{invitation?.email}</span>
              </div>
              {invitation?.companyName && (
                <div>
                  <span className="font-medium text-indigo-900">Tvrtka:</span>{" "}
                  <span className="text-indigo-700">{invitation.companyName}</span>
                </div>
              )}
              {invitation?.message && (
                <div>
                  <span className="font-medium text-indigo-900">Poruka:</span>{" "}
                  <p className="mt-1 text-indigo-700">{invitation.message}</p>
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="rounded-md bg-danger-bg p-3 text-sm text-danger-text">{error}</div>
            )}

            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Ime i prezime
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Vaše ime i prezime"
                error={errors.name?.message}
                {...register("name")}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Lozinka
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
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Prihvaćam poziv...
                </>
              ) : (
                "Prihvati poziv i registriraj se"
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Prihvaćanjem poziva slažete se s našim{" "}
              <Link href="/terms" className="text-link hover:underline">
                uvjetima korištenja
              </Link>{" "}
              i{" "}
              <Link href="/privacy" className="text-link hover:underline">
                politikom privatnosti
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
