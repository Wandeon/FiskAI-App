"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { AuthStep, AuthFlowState, UserInfo } from "./types"

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

  const setStep = useCallback((step: AuthStep) => {
    setState((s) => ({ ...s, step, error: null }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState((s) => ({ ...s, error, isLoading: false }))
  }, [])

  const setLoading = useCallback((isLoading: boolean) => {
    setState((s) => ({ ...s, isLoading }))
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
          setError(data.error || "Greska pri provjeri emaila")
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
        setError("Greska pri povezivanju")
      }
    },
    [setLoading, setError]
  )

  const sendVerificationCode = useCallback(
    async (type: "EMAIL_VERIFICATION" | "PASSWORD_RESET", userId?: string) => {
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
          setError(data.error || "Greska pri slanju koda")
          return
        }

        setState((s) => ({ ...s, step: "verify", isLoading: false }))
      } catch (error) {
        setError("Greska pri slanju koda")
      }
    },
    [state.email, setLoading, setError]
  )

  const handleSuccess = useCallback(() => {
    setState((s) => ({ ...s, step: "success", isLoading: false }))

    setTimeout(() => {
      router.push("/dashboard")
    }, 1500)
  }, [router])

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
            await sendVerificationCode("EMAIL_VERIFICATION")
            return
          }
          setError("Neispravna lozinka")
          return
        }

        handleSuccess()
      } catch (error) {
        setError("Greska pri prijavi")
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
          setError(data.error || "Greska pri registraciji")
          return
        }

        // Send verification code
        await sendVerificationCode("EMAIL_VERIFICATION", data.userId)
      } catch (error) {
        setError("Greska pri registraciji")
      }
    },
    [state.email, setLoading, setError, sendVerificationCode]
  )

  const verifyCode = useCallback(
    async (code: string) => {
      setLoading(true)
      setError(null)

      try {
        const res = await fetch("/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: state.email,
            code,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "Neispravan kod")
          return false
        }

        // Sign in the user after successful OTP verification
        if (data.userId) {
          const result = await signIn("credentials", {
            email: state.email,
            password: `__OTP_VERIFIED__${data.userId}`,
            redirect: false,
          })

          if (result?.error) {
            setError("Greska pri prijavi")
            return false
          }
        }

        handleSuccess()
        return true
      } catch (error) {
        setError("Greska pri verifikaciji")
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
        setError(data.error || "Greska pri slanju koda")
        return
      }

      setState((s) => ({ ...s, step: "reset", isLoading: false }))
    } catch (error) {
      setError("Greska pri slanju koda")
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
          setError(data.error || "Greska pri resetiranju lozinke")
          return false
        }

        // Sign in with the new password
        const result = await signIn("credentials", {
          email: state.email,
          password: newPassword,
          redirect: false,
        })

        if (result?.error) {
          setError("Greska pri prijavi")
          return false
        }

        handleSuccess()
        return true
      } catch (error) {
        setError("Greska pri resetiranju lozinke")
        return false
      }
    },
    [state.email, setLoading, setError, handleSuccess]
  )

  const authenticateWithPasskey = useCallback(async () => {
    // Passkey auth - simplified version without WebAuthn for now
    setError("Passkeys nisu trenutno podrzani")
  }, [setError])

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
    authenticateWithPasskey,
    register,
    verifyCode,
    sendVerificationCode,
    startPasswordReset,
    resetPassword,
    goBack,
  }
}
