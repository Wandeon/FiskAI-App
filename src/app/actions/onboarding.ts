// Re-export from canonical location for backwards compatibility with app routes
// Components should import from @/lib/actions/onboarding instead
export {
  getOnboardingData,
  createMinimalCompany,
  saveOnboardingData,
  type OnboardingData,
} from "@/lib/actions/onboarding"
