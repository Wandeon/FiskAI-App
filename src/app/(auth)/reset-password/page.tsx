"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { resetPassword } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Lozinka mora imati najmanje 8 znakova"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Lozinke se ne podudaraju",
  path: ["confirmPassword"],
})

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  })

  useEffect(() => {
    if (!token) {
      setError("Token nedostaje. Molimo zatražite novo resetiranje lozinke.")
    }
  }, [token])

  async function onSubmit(data: ResetPasswordInput) {
    if (!token) {
      setError("Token nedostaje")
      return
    }

    setLoading(true)
    setError(null)

    const result = await resetPassword(token, data.password)

    if (result.error) {
      setError(result.error)
      setLoading(false)
    } else {
      // Success - redirect to login with success message
      router.push("/login?reset=success")
    }
  }

  if (!token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Nevažeći link</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-600">
            <p className="font-medium">Token nedostaje ili je nevažeći</p>
            <p className="mt-1">
              Molimo zatražite novo resetiranje lozinke.
            </p>
          </div>

          <div className="mt-4 text-center">
            <Link
              href="/forgot-password"
              className="text-sm text-blue-600 hover:underline"
            >
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
        <CardDescription>
          Unesite svoju novu lozinku
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
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
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Povratak na prijavu
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
