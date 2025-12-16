#!/usr/bin/env tsx
// scripts/seed-news-categories.ts

import { drizzleDb } from "../src/lib/db/drizzle"
import { newsCategories } from "../src/lib/db/schema"
import { eq } from "drizzle-orm"

interface CategoryDefinition {
  id: string
  slug: string
  nameHr: string
  parentId?: string
  icon: string
  color: string
  sortOrder: number
}

const categoriesData: CategoryDefinition[] = [
  // Top-level: Porezi (Taxes)
  {
    id: "porezi",
    slug: "porezi",
    nameHr: "Porezi",
    icon: "receipt",
    color: "#3b82f6", // blue-500
    sortOrder: 1,
  },
  {
    id: "pdv",
    slug: "pdv",
    nameHr: "PDV",
    parentId: "porezi",
    icon: "percent",
    color: "#60a5fa", // blue-400
    sortOrder: 1,
  },
  {
    id: "porez-na-dobit",
    slug: "porez-na-dobit",
    nameHr: "Porez na dobit",
    parentId: "porezi",
    icon: "building-2",
    color: "#60a5fa", // blue-400
    sortOrder: 2,
  },
  {
    id: "porez-na-dohodak",
    slug: "porez-na-dohodak",
    nameHr: "Porez na dohodak",
    parentId: "porezi",
    icon: "user-circle",
    color: "#60a5fa", // blue-400
    sortOrder: 3,
  },
  {
    id: "doprinosi",
    slug: "doprinosi",
    nameHr: "Doprinosi",
    parentId: "porezi",
    icon: "shield-check",
    color: "#60a5fa", // blue-400
    sortOrder: 4,
  },

  // Top-level: Propisi (Regulations)
  {
    id: "propisi",
    slug: "propisi",
    nameHr: "Propisi",
    icon: "book-open",
    color: "#8b5cf6", // violet-500
    sortOrder: 2,
  },
  {
    id: "zakoni",
    slug: "zakoni",
    nameHr: "Zakoni",
    parentId: "propisi",
    icon: "scale",
    color: "#a78bfa", // violet-400
    sortOrder: 1,
  },
  {
    id: "pravilnici",
    slug: "pravilnici",
    nameHr: "Pravilnici",
    parentId: "propisi",
    icon: "file-text",
    color: "#a78bfa", // violet-400
    sortOrder: 2,
  },
  {
    id: "rokovi",
    slug: "rokovi",
    nameHr: "Rokovi",
    parentId: "propisi",
    icon: "calendar-clock",
    color: "#a78bfa", // violet-400
    sortOrder: 3,
  },

  // Top-level: Poslovanje (Business)
  {
    id: "poslovanje",
    slug: "poslovanje",
    nameHr: "Poslovanje",
    icon: "briefcase",
    color: "#10b981", // emerald-500
    sortOrder: 3,
  },
  {
    id: "financije",
    slug: "financije",
    nameHr: "Financije",
    parentId: "poslovanje",
    icon: "banknote",
    color: "#34d399", // emerald-400
    sortOrder: 1,
  },
  {
    id: "racunovodstvo",
    slug: "racunovodstvo",
    nameHr: "Računovodstvo",
    parentId: "poslovanje",
    icon: "calculator",
    color: "#34d399", // emerald-400
    sortOrder: 2,
  },
  {
    id: "upravljanje",
    slug: "upravljanje",
    nameHr: "Upravljanje",
    parentId: "poslovanje",
    icon: "users",
    color: "#34d399", // emerald-400
    sortOrder: 3,
  },
]

async function seedNewsCategories() {
  console.log("🌱 Seeding news categories...")

  try {
    let inserted = 0
    let updated = 0

    // Insert parent categories first (those without parentId)
    const parentCategories = categoriesData.filter((cat) => !cat.parentId)
    const childCategories = categoriesData.filter((cat) => cat.parentId)

    console.log("\n📦 Inserting parent categories...")
    for (const category of parentCategories) {
      try {
        await drizzleDb.insert(newsCategories).values(category)
        inserted++
        console.log(`  ✓ Inserted: ${category.nameHr} (${category.slug})`)
      } catch (error) {
        // If it already exists, update it
        try {
          await drizzleDb
            .update(newsCategories)
            .set({
              nameHr: category.nameHr,
              icon: category.icon,
              color: category.color,
              sortOrder: category.sortOrder,
            })
            .where(eq(newsCategories.id, category.id))

          updated++
          console.log(`  ↻ Updated: ${category.nameHr} (${category.slug})`)
        } catch (updateError) {
          console.error(`  ✗ Error with ${category.nameHr}:`, updateError)
        }
      }
    }

    console.log("\n📦 Inserting child categories...")
    for (const category of childCategories) {
      try {
        await drizzleDb.insert(newsCategories).values(category)
        inserted++
        console.log(
          `  ✓ Inserted: ${category.nameHr} (${category.slug}) under ${category.parentId}`
        )
      } catch (error) {
        // If it already exists, update it
        try {
          await drizzleDb
            .update(newsCategories)
            .set({
              nameHr: category.nameHr,
              parentId: category.parentId,
              icon: category.icon,
              color: category.color,
              sortOrder: category.sortOrder,
            })
            .where(eq(newsCategories.id, category.id))

          updated++
          console.log(
            `  ↻ Updated: ${category.nameHr} (${category.slug}) under ${category.parentId}`
          )
        } catch (updateError) {
          console.error(`  ✗ Error with ${category.nameHr}:`, updateError)
        }
      }
    }

    console.log(`\n✅ Seeding complete!`)
    console.log(`   Inserted: ${inserted} categories`)
    console.log(`   Updated: ${updated} categories`)
    console.log(`   Total: ${categoriesData.length} categories`)
    console.log(`\n📊 Category Structure:`)
    console.log(`   └─ Porezi (porezi) - 4 subcategories`)
    console.log(`   └─ Propisi (propisi) - 3 subcategories`)
    console.log(`   └─ Poslovanje (poslovanje) - 3 subcategories`)

    process.exit(0)
  } catch (error) {
    console.error("❌ Error seeding news categories:", error)
    process.exit(1)
  }
}

seedNewsCategories()
