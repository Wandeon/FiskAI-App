"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { requestPasswordReset } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"

const forgotPasswordSchema = z.object({
  email: z.string().email("Unesite važeću email adresu"),
})

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  })

  async function onSubmit(data: ForgotPasswordInput) {
    setLoading(true)

    await requestPasswordReset(data.email)

    // Always show success message
    setSuccess(true)
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Zaboravljena lozinka</CardTitle>
        <CardDescription>
          Unesite svoju email adresu i poslat ćemo vam link za resetiranje lozinke
        </CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <div className="space-y-4">
            <div className="rounded-md bg-success-bg p-4 text-sm text-success-text">
              <p className="font-medium">Email poslan!</p>
              <p className="mt-1">
                Ako postoji račun s tom email adresom, poslali smo link za resetiranje lozinke.
                Provjerite svoju pristiglu poštu.
              </p>
              <p className="mt-2 text-xs">Link vrijedi 1 sat.</p>
            </div>

            <div className="text-center">
              <Link href="/login" className="text-sm text-link hover:underline">
                Povratak na prijavu
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email adresa
              </label>
              <Input
                id="email"
                type="email"
                placeholder="vas@email.com"
                error={errors.email?.message}
                {...register("email")}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Slanje..." : "Pošalji link za resetiranje"}
            </Button>

            <div className="text-center space-y-2">
              <Link href="/login" className="block text-sm text-secondary hover:text-foreground">
                Povratak na prijavu
              </Link>
              <p className="text-sm text-secondary">
                Nemate račun?{" "}
                <Link href="/register" className="text-link hover:underline">
                  Registrirajte se
                </Link>
              </p>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
