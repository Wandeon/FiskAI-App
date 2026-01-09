/**
 * WordPress REST API types for marketing content
 * Fetched at BUILD TIME only - no runtime requests.
 */

export interface WPPost {
  id: number
  date: string
  date_gmt: string
  modified: string
  modified_gmt: string
  slug: string
  status: "publish" | "draft" | "pending" | "private"
  type: string
  link: string
  title: { rendered: string }
  content: { rendered: string; protected: boolean }
  excerpt: { rendered: string; protected: boolean }
  featured_media: number
  categories: number[]
  tags: number[]
  acf?: {
    impact_level?: "high" | "medium" | "low"
    tldr?: string
    action_items?: string[]
  }
}

export interface WPCategory {
  id: number
  count: number
  name: string
  slug: string
}

export interface WPTag {
  id: number
  name: string
  slug: string
}

// Normalized types for our app
export interface NewsPost {
  id: string
  slug: string
  title: string
  content: string
  excerpt: string
  publishedAt: string
  modifiedAt: string
  categoryId: string | null
  categoryName: string | null
  categorySlug: string | null
  tags: string[]
  featuredImageUrl: string | null
  impactLevel: "high" | "medium" | "low" | null
  tldr: string | null
  actionItems: string[] | null
}

export interface NewsCategory {
  id: string
  slug: string
  name: string
  count: number
}
