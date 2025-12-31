// Re-export from canonical location for backwards compatibility with app routes
// Components should import from @/lib/actions/auth instead
export {
  register,
  login,
  logout,
  requestPasswordReset,
  validatePasswordResetToken,
  resetPassword,
  loginWithPasskey,
  verifyEmail,
  resendVerificationEmail,
} from "@/lib/actions/auth"
