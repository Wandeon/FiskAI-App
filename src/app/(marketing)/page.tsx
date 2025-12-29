import type { Metadata } from "next"
import { MarketingHomeClient } from "@/components/marketing/MarketingHomeClient"
import { getLatestPosts } from "@/lib/news/queries"

// Force dynamic rendering - database not available during static build
export const dynamic = "force-dynamic"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export const metadata: Metadata = {
  title: "FiskAI - Računovodstveni softver za male poduzetnike",
  description:
    "Moderan računovodstveni softver za obrt i d.o.o. u Hrvatskoj. E-fakturiranje, fiskalizacija, automatsko knjiženje troškova uz AI asistenta. Besplatna proba.",
  keywords: [
    "računovodstveni softver",
    "računovodstvo za obrt",
    "računovodstvo za d.o.o.",
    "e-fakturiranje",
    "fiskalizacija",
    "paušalni obrt",
    "knjigovodstvo hrvatska",
    "AI računovodstvo",
  ],
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: "FiskAI - Računovodstveni softver za male poduzetnike",
    description:
      "Moderan računovodstveni softver za obrt i d.o.o. u Hrvatskoj. E-fakturiranje, fiskalizacija, automatsko knjiženje troškova uz AI asistenta.",
    url: BASE_URL,
    siteName: "FiskAI",
    locale: "hr_HR",
    type: "website",
    images: [
      {
        url: `${BASE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "FiskAI - Računovodstveni softver za male poduzetnike",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FiskAI - Računovodstveni softver za male poduzetnike",
    description:
      "Moderan računovodstveni softver za obrt i d.o.o. u Hrvatskoj. E-fakturiranje, fiskalizacija, automatsko knjiženje.",
    images: [`${BASE_URL}/opengraph-image`],
  },
}

export default async function MarketingHomePage() {
  const latestNews = await getLatestPosts(4)

  return <MarketingHomeClient latestNews={latestNews} />
}
