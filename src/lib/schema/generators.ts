import type { FAQItem } from "@/lib/knowledge-hub/types"

interface BreadcrumbItem {
  name: string
  url: string
}

interface HowToStep {
  name: string
  text: string
  image?: string
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function generateFAQSchema(items: FAQItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  }
}

export function generateHowToSchema(
  title: string,
  description: string,
  steps: HowToStep[],
  totalTime?: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: title,
    description,
    ...(totalTime && { totalTime }),
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.image && { image: step.image }),
    })),
  }
}

export function generateArticleSchema(
  title: string,
  description: string,
  datePublished: string,
  dateModified: string,
  url: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    datePublished,
    dateModified,
    url,
    publisher: {
      "@type": "Organization",
      name: "FiskAI",
      url: "https://fiskai.hr",
    },
  }
}

export function generateDefinedTermSchema(term: string, definition: string, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: term,
    description: definition,
    url,
  }
}

export function generateWebApplicationSchema(name: string, description: string, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    description,
    url,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
  }
}

/**
 * Organization schema - includes company info, social profiles, and contact
 * Used at root level for site-wide organization identity
 */
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://fiskai.hr/#organization",
    name: "FiskAI",
    legalName: "FiskAI d.o.o.",
    url: "https://fiskai.hr",
    // Note: Using icon.svg as logo until PNG brand assets are ready
    logo: {
      "@type": "ImageObject",
      url: "https://fiskai.hr/icon.svg",
      // SVG doesn't require dimensions, but schema prefers them
      width: 512,
      height: 512,
    },
    description:
      "AI-powered e-invoicing and fiscalization platform for Croatian businesses. Automated compliance, smart bookkeeping, and regulatory guidance.",
    foundingDate: "2024",
    address: {
      "@type": "PostalAddress",
      addressCountry: "HR",
      addressLocality: "Zagreb",
      addressRegion: "Grad Zagreb",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "podrska@fiskai.hr",
        availableLanguage: ["Croatian", "English"],
      },
      {
        "@type": "ContactPoint",
        contactType: "sales",
        email: "prodaja@fiskai.hr",
        availableLanguage: ["Croatian", "English"],
      },
    ],
    sameAs: ["https://github.com/fiskai"],
    knowsAbout: [
      "Croatian fiscalization",
      "E-invoicing",
      "Tax compliance",
      "Small business accounting",
      "AI bookkeeping",
    ],
  }
}

/**
 * WebSite schema - for site identity
 * Note: potentialAction removed until search page is implemented (see issue #190)
 */
export function generateWebSiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://fiskai.hr/#website",
    url: "https://fiskai.hr",
    name: "FiskAI",
    description: "AI-powered e-invoicing and fiscalization platform for Croatian businesses",
    publisher: {
      "@id": "https://fiskai.hr/#organization",
    },
    inLanguage: ["hr", "en"],
  }
}

/**
 * SoftwareApplication schema - for app store rich results
 */
export function generateSoftwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "FiskAI",
    operatingSystem: "Web",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Accounting Software",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "99",
      priceCurrency: "EUR",
      offerCount: 4,
    },
    // Note: aggregateRating removed until we have verified user reviews
    // Google's structured data guidelines require ratings to be based on actual user reviews
    featureList: [
      "AI-powered bookkeeping",
      "Automatic e-invoicing",
      "Croatian fiscalization",
      "Multi-company support",
      "Tax compliance monitoring",
      "Bank reconciliation",
    ],
  }
}

/**
 * NewsArticle schema - for news/blog posts with proper authorship
 */
export function generateNewsArticleSchema(
  headline: string,
  description: string,
  datePublished: string,
  dateModified: string,
  url: string,
  imageUrl?: string,
  authorName?: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline,
    description,
    datePublished,
    dateModified,
    url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    ...(imageUrl && {
      image: {
        "@type": "ImageObject",
        url: imageUrl,
        width: 1200,
        height: 630,
      },
    }),
    author: {
      "@type": authorName ? "Person" : "Organization",
      name: authorName || "FiskAI",
      url: "https://fiskai.hr",
    },
    publisher: {
      "@type": "Organization",
      name: "FiskAI",
      logo: {
        "@type": "ImageObject",
        url: "https://fiskai.hr/icon.svg",
        width: 512,
        height: 512,
      },
    },
    isAccessibleForFree: true,
    inLanguage: "hr",
  }
}
