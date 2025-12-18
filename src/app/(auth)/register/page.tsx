"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { registerSchema, RegisterInput } from "@/lib/validations"
import { register as registerUser } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Chrome } from "lucide-react"
import { getProviders, signIn } from "next-auth/react"

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleAvailable, setGoogleAvailable] = useState(false)

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
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(data: RegisterInput) {
    setLoading(true)
    setError(null)

    const result = await registerUser(data)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else if (result?.success && result?.email) {
      router.push(`/check-email?email=${encodeURIComponent(result.email)}`)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Registracija</CardTitle>
      </CardHeader>
      <CardContent>
        {googleAvailable && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            >
              <Chrome className="h-4 w-4" />
              Nastavi s Google
            </Button>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-[var(--muted)]">ili</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Ime i prezime
            </label>
            <Input
              id="name"
              placeholder="Ivan Horvat"
              error={errors.name?.message}
              {...register("name")}
            />
          </div>

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

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Potvrdite lozinku
            </label>
            <Input
              id="confirmPassword"
              type="password"
              error={errors.confirmPassword?.message}
              {...register("confirmPassword")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Registracija..." : "Registriraj se"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Već imate račun?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            Prijavite se
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
