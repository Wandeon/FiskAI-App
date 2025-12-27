import { MarketingHomeClient } from "@/components/marketing/MarketingHomeClient"
import { getLatestPosts } from "@/lib/news/queries"

// Force dynamic rendering - database not available during static build
export const dynamic = "force-dynamic"

export default async function MarketingHomePage() {
  const latestNews = await getLatestPosts(4)

  return <MarketingHomeClient latestNews={latestNews} />
}
