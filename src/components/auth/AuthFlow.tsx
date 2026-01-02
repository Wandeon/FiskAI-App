"use client"

import { AnimatePresence, motion } from "framer-motion"
import { signIn } from "next-auth/react"
import { useAuthFlow } from "./useAuthFlow"
import { FloatingOrbs } from "./FloatingOrbs"
import { GlassCard } from "./GlassCard"
import {
  IdentifyStep,
  AuthenticateStep,
  RegisterStep,
  VerifyStep,
  ResetStep,
  SuccessStep,
} from "./steps"

export function AuthFlow() {
  const auth = useAuthFlow()

  const handleGoogleSignIn = () => {
    void signIn("google", { callbackUrl: "/dashboard" })
  }

  const handleForgotPassword = () => {
    void auth.startPasswordReset()
  }

  const handlePasskeyAuth = async () => {
    await auth.authenticateWithPasskey()
  }

  return (
    <div className="relative min-h-screen w-full">
      {/* Floating Orbs Background */}
      <FloatingOrbs state={auth.step} />

      {/* Auth Card */}
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <motion.div
          layout
          className="w-full max-w-md"
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          <GlassCard>
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
                  onResend={async () => {
                    await auth.sendVerificationCode(auth.isNewUser ? "EMAIL_VERIFY" : "LOGIN_VERIFY")
                  }}
                  onBack={auth.goBack}
                  isLoading={auth.isLoading}
                  error={auth.error}
                />
              )}

              {auth.step === "reset" && (
                <ResetStep
                  key="reset"
                  email={auth.email}
                  onSubmit={auth.resetPassword}
                  onVerify={auth.verifyCode}
                  onResend={async () => {
                    await auth.sendVerificationCode("PASSWORD_RESET")
                  }}
                  onBack={auth.goBack}
                  isLoading={auth.isLoading}
                  error={auth.error}
                />
              )}

              {auth.step === "success" && (
                <SuccessStep key="success" isNewUser={auth.isNewUser} userName={auth.name} />
              )}
            </AnimatePresence>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  )
}
