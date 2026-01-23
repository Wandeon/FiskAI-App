// Re-export from canonical location for backwards compatibility with app routes
// Components should import from @/lib/actions/newsletter instead
export { subscribeToNewsletter } from "@/lib/actions/newsletter"
export type { NewsletterSubscribeResult } from "@/lib/actions/newsletter.types"
