// src/app/(marketing)/vodic/page.tsx
import Link from "next/link"
import { getAllGuides } from "@/lib/knowledge-hub/mdx"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Vodiči za poslovanje | FiskAI",
  description:
    "Kompletan vodič za sve oblike poslovanja u Hrvatskoj - paušalni obrt, obrt na dohodak, d.o.o. i više.",
}

export default function GuidesIndexPage() {
  const guides = getAllGuides()

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Vodiči za poslovanje</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Sve što trebate znati o poslovanju u Hrvatskoj. Porezni razredi, doprinosi, registracija i
          obveze.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {guides.map((guide) => (
          <Link key={guide.slug} href={`/vodic/${guide.slug}`}>
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{guide.frontmatter.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm mb-4">{guide.frontmatter.description}</p>
                <div className="flex flex-wrap gap-2">
                  {guide.frontmatter.requiresFiscalization && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Fiskalizacija
                    </span>
                  )}
                  {guide.frontmatter.maxRevenue && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Max {guide.frontmatter.maxRevenue.toLocaleString()} EUR
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
