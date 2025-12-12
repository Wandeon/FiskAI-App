"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { loginSchema, LoginInput } from "@/lib/validations"
import { login } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

    const result = await login(data)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Prijava u FiskAI</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
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
            <div className="flex justify-between items-center">
              <label htmlFor="password" className="text-sm font-medium">
                Lozinka
              </label>
              <Link 
                href="/forgot-password" 
                className="text-xs text-blue-600 hover:underline"
              >
                Zaboravljena lozinka?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              error={errors.password?.message}
              {...register("password")}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Prijava..." : "Prijavi se"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Nemate račun?{" "}
          <Link href="/register" className="text-blue-600 hover:underline">
            Registrirajte se
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
