export const CACHE_TAGS = {
  KB_GUIDES: "kb_guides",
  KB_GLOSSARY: "kb_glossary",
  KB_FAQ: "kb_faq",
  KB_HOWTO: "kb_howto",
  KB_COMPARISONS: "kb_comparisons",
  KB_NEWS: "kb_news",
  MARKETING: "marketing",
  KB_ALL: "kb_all",
} as const

export function getCacheHeaders(pathname: string): Record<string, string> | null {
  // Never cache authenticated routes
  if (
    pathname.startsWith("/app/") ||
    pathname.startsWith("/staff/") ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/")
  ) {
    return null
  }

  // Determine cache tag based on route
  let tag: (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS] = CACHE_TAGS.MARKETING
  if (pathname.startsWith("/vodic/")) tag = CACHE_TAGS.KB_GUIDES
  else if (pathname.startsWith("/pojmovnik/") || pathname.startsWith("/glossary/"))
    tag = CACHE_TAGS.KB_GLOSSARY
  else if (pathname.startsWith("/faq/")) tag = CACHE_TAGS.KB_FAQ
  else if (pathname.startsWith("/kako-da/")) tag = CACHE_TAGS.KB_HOWTO
  else if (pathname.startsWith("/usporedba/")) tag = CACHE_TAGS.KB_COMPARISONS
  else if (pathname.startsWith("/vijesti/")) tag = CACHE_TAGS.KB_NEWS

  return {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=86400",
    "Cache-Tag": `${tag}, ${CACHE_TAGS.KB_ALL}`,
    Vary: "Accept-Language",
  }
}
