"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn, getSession } from "next-auth/react"
import { startAuthentication } from "@simplewebauthn/browser"
import type { PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/types"
import { AuthStep, AuthFlowState, UserInfo } from "./types"
import { setFaviconState, resetFavicon, flashFavicon } from "@/lib/favicon"

// Path-based routing for different roles (all on same origin: app.fiskai.hr)
function getPathForRole(role: "USER" | "STAFF" | "ADMIN"): string {
  switch (role) {
    case "ADMIN":
      return "/admin"
    case "STAFF":
      return "/staff"
    case "USER":
    default:
      return "/"
  }
}

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
      } catch {
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
      } catch {
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

    setTimeout(() => {
      void (async () => {
        try {
          // Fetch the session to get the latest system role securely
          const session = await getSession()
          const role = (session?.user?.systemRole as "USER" | "STAFF" | "ADMIN") || "USER"

          // If we have a valid callbackUrl on the same origin, use it
          if (callbackUrl) {
            try {
              const url = new URL(callbackUrl)
              // Security: only allow callbacks to app.fiskai.hr (same origin)
              if (url.protocol.startsWith("http") && url.host === window.location.host) {
                router.push(url.pathname + url.search)
                return
              }
              // For cross-origin callbacks, extract the path and use it
              if (url.protocol.startsWith("http") && url.hostname.endsWith("fiskai.hr")) {
                router.push(url.pathname + url.search)
                return
              }
            } catch {
              // Invalid URL, fall through to role-based redirect
            }
          }

          // Path-based routing: all roles stay on app.fiskai.hr
          // USER → / (app-control-center via middleware)
          // ADMIN → /admin
          // STAFF → /staff
          const destinationPath = getPathForRole(role)
          router.push(destinationPath)
        } catch {
          // Fallback to root
          router.push("/")
        }
      })()
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
        void handleSuccess()
      } catch {
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
      } catch {
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
          if (!data.loginToken) {
            setError("Greška pri prijavi")
            return false
          }

          const result = await signIn("credentials", {
            email: state.email,
            loginToken: data.loginToken,
            redirect: false,
          })

          if (result?.error) {
            setError("Greška pri prijavi")
            return false
          }
        }

        void handleSuccess()
        return true
      } catch {
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
    } catch {
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

        void handleSuccess()
        return true
      } catch {
        setError("Greška pri resetiranju lozinke")
        return false
      }
    },
    [state.email, setLoading, setError, handleSuccess]
  )

  const authenticateWithPasskey = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Check if WebAuthn is supported
      if (!window?.PublicKeyCredential || !navigator?.credentials) {
        setError("Passkeys nisu podržani u ovom pregledniku")
        return
      }

      // Start passkey authentication
      const startResponse = await fetch("/api/webauthn/login/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: state.email }),
      })

      if (!startResponse.ok) {
        const data = await startResponse.json()
        if (startResponse.status === 404) {
          setError("Niste registrirali niti jedan passkey")
        } else {
          setError(data.error || "Greška pri autentifikaciji")
        }
        return
      }

      const { userId, ...options } =
        (await startResponse.json()) as PublicKeyCredentialRequestOptionsJSON & {
          userId: string
        }

      // Prompt user for passkey
      const authenticationResponse = await startAuthentication(options)

      // Finish authentication
      const finishResponse = await fetch("/api/webauthn/login/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          response: authenticationResponse,
        }),
      })

      if (!finishResponse.ok) {
        const data = await finishResponse.json()
        setError(data.error || "Greška pri autentifikaciji")
        return
      }

      const { loginToken } = await finishResponse.json()

      // Sign in with the special passkey token
      if (!loginToken) {
        setError("Greška pri prijavi")
        return
      }
      const result = await signIn("credentials", {
        email: state.email,
        loginToken,
        redirect: false,
      })

      if (result?.error) {
        setError("Greška pri prijavi")
        return
      }

      // Success - redirect based on role
      void handleSuccess()
    } catch (error) {
      console.error("Passkey authentication error:", error)
      if (error instanceof Error && error.name === "NotAllowedError") {
        setError("Autentifikacija otkazana")
      } else {
        setError("Greška pri autentifikaciji s passkey-em")
      }
    }
  }, [state.email, setLoading, setError, handleSuccess])

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
