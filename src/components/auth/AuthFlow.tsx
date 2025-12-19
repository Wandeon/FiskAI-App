"use client"

import { AnimatePresence, motion } from "framer-motion"
import { signIn } from "next-auth/react"
import { useAuthFlow } from "./useAuthFlow"
import { AuroraBackground } from "./AuroraBackground"
import {
  IdentifyStep,
  AuthenticateStep,
  RegisterStep,
  VerifyStep,
  SuccessStep,
} from "./steps"

export function AuthFlow() {
  const auth = useAuthFlow()

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" })
  }

  const handleForgotPassword = () => {
    // Navigate to forgot password with email pre-filled
    window.location.href = `/forgot-password?email=${encodeURIComponent(auth.email)}`
  }

  const handlePasskeyAuth = () => {
    // TODO: Implement passkey authentication
    console.log("Passkey auth not yet implemented")
  }

  return (
    <div className="relative min-h-screen w-full">
      {/* Aurora Background */}
      <AuroraBackground state={auth.step} />

      {/* Auth Card */}
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <motion.div
          layout
          className="w-full max-w-md overflow-hidden rounded-2xl bg-white/90 p-8 shadow-2xl backdrop-blur-xl"
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          <AnimatePresence mode="wait">
            {auth.step === "identify" && (
              <IdentifyStep
                key="identify"
                onSubmit={auth.checkEmail}
                onGoogleSignIn={handleGoogleSignIn}
                isLoading={auth.isLoading}
                error={auth.error}
              />
            )}

            {auth.step === "authenticate" && (
              <AuthenticateStep
                key="authenticate"
                email={auth.email}
                userName={auth.name}
                hasPasskey={auth.hasPasskey}
                onSubmit={auth.authenticate}
                onPasskeyAuth={handlePasskeyAuth}
                onForgotPassword={handleForgotPassword}
                onBack={auth.goBack}
                isLoading={auth.isLoading}
                error={auth.error}
              />
            )}

            {auth.step === "register" && (
              <RegisterStep
                key="register"
                email={auth.email}
                onSubmit={auth.register}
                onBack={auth.goBack}
                isLoading={auth.isLoading}
                error={auth.error}
              />
            )}

            {auth.step === "verify" && (
              <VerifyStep
                key="verify"
                email={auth.email}
                onVerify={auth.verifyCode}
                onResend={() => auth.sendVerificationCode(auth.isNewUser ? "EMAIL_VERIFY" : "LOGIN_VERIFY")}
                onBack={auth.goBack}
                isLoading={auth.isLoading}
                error={auth.error}
              />
            )}

            {auth.step === "success" && (
              <SuccessStep
                key="success"
                isNewUser={auth.isNewUser}
                userName={auth.name}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
