export interface WebApplicationSchemaProps {
  name: string
  description: string
  url: string
  applicationCategory?: string
  operatingSystem?: string
  offers?: {
    price: string
    priceCurrency: string
  }
}

export function generateWebApplicationSchema({
  name,
  description,
  url,
  applicationCategory = "BusinessApplication",
  operatingSystem = "Web",
  offers = { price: "0", priceCurrency: "EUR" },
}: WebApplicationSchemaProps) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    description,
    url,
    applicationCategory,
    operatingSystem,
    offers: {
      "@type": "Offer",
      price: offers.price,
      priceCurrency: offers.priceCurrency,
    },
    provider: {
      "@type": "Organization",
      name: "FiskAI",
      url: "https://fisk.ai",
    },
  }
}
