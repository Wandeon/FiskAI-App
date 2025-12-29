"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn, getSession } from "next-auth/react"
import { AuthStep, AuthFlowState, UserInfo } from "./types"
import { setFaviconState, resetFavicon, flashFavicon } from "@/lib/favicon"
import { getRedirectUrlForSystemRole } from "@/lib/middleware/subdomain"

const initialState: AuthFlowState = {
  step: "identify",
  email: "",
  name: "",
  isNewUser: false,
  hasPasskey: false,
  error: null,
  isLoading: false,
}

export function useAuthFlow() {
  const [state, setState] = useState<AuthFlowState>(initialState)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Reset favicon on unmount
  useEffect(() => {
    return () => resetFavicon()
  }, [])

  const setStep = useCallback((step: AuthStep) => {
    setState((s) => ({ ...s, step, error: null }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error, isLoading: false }))
    if (error) {
      flashFavicon("error", 2000)
    }
  }, [])

  const setLoading = useCallback((isLoading: boolean) => {
    setState((s) => ({ ...s, isLoading }))
    if (isLoading) {
      setFaviconState("loading")
    } else {
      resetFavicon()
    }
  }, [])

  const checkEmail = useCallback(
    async (email: string) => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch("/api/auth/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })

        const data: UserInfo = await res.json()

        if (!res.ok) {
          setError(data.error || "Greška pri provjeri emaila")
          return
        }

        setState((s) => ({
          ...s,
          email,
          isNewUser: !data.exists,
          hasPasskey: data.hasPasskey || false,
          name: data.name || "",
          step: data.exists ? "authenticate" : "register",
          isLoading: false,
          error: null,
        }))
      } catch (error) {
        setError("Greška pri povezivanju")
      }
    },
    [setLoading, setError]
  )

  const sendVerificationCode = useCallback(
    async (type: "EMAIL_VERIFY" | "LOGIN_VERIFY" | "PASSWORD_RESET", userId?: string) => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch("/api/auth/send-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: state.email,
            type,
            userId,
          }),
        })

        if (!res.ok) {
          const data = await res.json()
          setError(data.error || "Greška pri slanju koda")
          return
        }

        setState((s) => ({ ...s, step: "verify", isLoading: false }))
      } catch (error) {
        setError("Greška pri slanju koda")
      }
    },
    [state.email, setLoading, setError]
  )

  const handleSuccess = useCallback(async () => {
    setState((s) => ({ ...s, step: "success", isLoading: false }))
    setFaviconState("success") // Amber glow on success

    // Check for callbackUrl in query params
    const callbackUrl = searchParams?.get("callbackUrl")

    setTimeout(async () => {
      try {
        // Fetch the session to get the latest system role securely
        const session = await getSession()
        const role = (session?.user?.systemRole as "USER" | "STAFF" | "ADMIN") || "USER"

        // If we have a valid callbackUrl, use it
        if (callbackUrl) {
          try {
            const url = new URL(callbackUrl)
            // Basic security check: ensure it's http/https and matches our domain structure ideally
            // For now, we trust NextAuth's internal handling, but since we are doing manual redirection:
            if (url.protocol.startsWith("http")) {
              window.location.href = url.toString()
              return
            }
          } catch (e) {
            // Invalid URL, fall through to role-based redirect
          }
        }

        // Construct the correct URL based on the user's role and current environment
        const destinationBase = getRedirectUrlForSystemRole(role, window.location.href)

        // If the destination hostname is different (e.g., app.fiskai.hr vs fiskai.hr),
        // use window.location.href to ensure a full redirect that picks up cookies correctly
        const currentHost = window.location.host
        const destUrl = new URL(destinationBase)

        // Add /dashboard if it's not already there (getRedirectUrlForSystemRole returns base domain)
        if (
          !destUrl.pathname.startsWith("/dashboard") &&
          !destUrl.pathname.startsWith("/select-role")
        ) {
          destUrl.pathname = "/dashboard"
        }

        if (destUrl.host !== currentHost) {
          window.location.href = destUrl.toString()
        } else {
          router.push(destUrl.pathname + destUrl.search)
        }
      } catch (error) {
        // Fallback to simple dashboard redirect
        router.push("/dashboard")
      }
    }, 1500)
  }, [router, searchParams])

  const authenticate = useCallback(
    async (password: string) => {
      setLoading(true)
      setError(null)

      try {
        const result = await signIn("credentials", {
          email: state.email,
          password,
          redirect: false,
        })

        if (result?.error) {
          if (result.error === "email_not_verified") {
            // Send OTP and go to verify step
            await sendVerificationCode("LOGIN_VERIFY")
            return
          }
          setError("Neispravna lozinka")
          return
        }

        // Success - redirect based on role
        handleSuccess()
      } catch (error) {
        setError("Greška pri prijavi")
      }
    },
    [state.email, setLoading, setError, sendVerificationCode, handleSuccess]
  )

  const register = useCallback(
    async (name: string, password: string, businessType?: string) => {
      setLoading(true)
      setError(null)

      try {
        // Create user
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: state.email,
            name,
            password,
            businessType,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "Greška pri registraciji")
          return
        }

        // Send verification code
        await sendVerificationCode("EMAIL_VERIFY", data.userId)
      } catch (error) {
        setError("Greška pri registraciji")
      }
    },
    [state.email, setLoading, setError, sendVerificationCode]
  )

  const verifyCode = useCallback(
    async (code: string, type: "EMAIL_VERIFY" | "LOGIN_VERIFY" = "EMAIL_VERIFY") => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch("/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: state.email,
            code,
            type,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "Neispravan kod")
          return false
        }

        // Sign in the user after successful OTP verification
        if (type === "EMAIL_VERIFY" || type === "LOGIN_VERIFY") {
          if (!data.userId) {
            setError("Greška pri prijavi")
            return false
          }

          const result = await signIn("credentials", {
            email: state.email,
            password: `__OTP_VERIFIED__${data.userId}`,
            redirect: false,
          })

          if (result?.error) {
            setError("Greška pri prijavi")
            return false
          }
        }

        handleSuccess()
        return true
      } catch (error) {
        setError("Greška pri verifikaciji")
        return false
      }
    },
    [state.email, setLoading, setError, handleSuccess]
  )

  const startPasswordReset = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: state.email,
          type: "PASSWORD_RESET",
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Greška pri slanju koda")
        return
      }

      setState((s) => ({ ...s, step: "reset", isLoading: false }))
    } catch (error) {
      setError("Greška pri slanju koda")
    }
  }, [state.email, setLoading, setError])

  const resetPassword = useCallback(
    async (code: string, newPassword: string) => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: state.email,
            code,
            newPassword,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "Greška pri resetiranju lozinke")
          return false
        }

        // Sign in with the new password
        const result = await signIn("credentials", {
          email: state.email,
          password: newPassword,
          redirect: false,
        })

        if (result?.error) {
          setError("Greška pri prijavi")
          return false
        }

        handleSuccess()
        return true
      } catch (error) {
        setError("Greška pri resetiranju lozinke")
        return false
      }
    },
    [state.email, setLoading, setError, handleSuccess]
  )

  const goBack = useCallback(() => {
    if (state.step === "authenticate" || state.step === "register") {
      setState(initialState)
    } else if (state.step === "verify") {
      setState((s) => ({
        ...s,
        step: s.isNewUser ? "register" : "authenticate",
        error: null,
      }))
    } else if (state.step === "reset") {
      setState((s) => ({
        ...s,
        step: "authenticate",
        error: null,
      }))
    }
  }, [state.step])

  return {
    ...state,
    setStep,
    setError,
    checkEmail,
    authenticate,
    register,
    verifyCode,
    sendVerificationCode,
    startPasswordReset,
    resetPassword,
    goBack,
  }
}
