#!/usr/bin/env tsx
// scripts/test-category-queries.ts
// Test various category queries to ensure proper Drizzle ORM usage

import { drizzleDb } from "../src/lib/db/drizzle"
import { newsCategories } from "../src/lib/db/schema"
import { eq, isNull, sql } from "drizzle-orm"

async function testCategoryQueries() {
  console.log("🧪 Testing category queries...\n")

  try {
    // Test 1: Get all categories
    console.log("Test 1: Get all categories")
    const allCategories = await drizzleDb.select().from(newsCategories)
    console.log(`✓ Found ${allCategories.length} categories\n`)

    // Test 2: Get only parent categories
    console.log("Test 2: Get parent categories (parentId IS NULL)")
    const parentCategories = await drizzleDb
      .select()
      .from(newsCategories)
      .where(isNull(newsCategories.parentId))
    console.log(`✓ Found ${parentCategories.length} parent categories`)
    parentCategories.forEach((cat) => console.log(`   - ${cat.nameHr}`))
    console.log()

    // Test 3: Get specific category by slug
    console.log("Test 3: Get category by slug (porezi)")
    const poreziCategory = await drizzleDb
      .select()
      .from(newsCategories)
      .where(eq(newsCategories.slug, "porezi"))
      .limit(1)
    if (poreziCategory.length > 0) {
      console.log(`✓ Found: ${poreziCategory[0].nameHr}`)
      console.log(`   ID: ${poreziCategory[0].id}`)
      console.log(`   Color: ${poreziCategory[0].color}`)
      console.log(`   Icon: ${poreziCategory[0].icon}\n`)
    }

    // Test 4: Get children of specific parent
    console.log("Test 4: Get children of 'porezi'")
    const poreziChildren = await drizzleDb
      .select()
      .from(newsCategories)
      .where(eq(newsCategories.parentId, "porezi"))
      .orderBy(newsCategories.sortOrder)
    console.log(`✓ Found ${poreziChildren.length} subcategories:`)
    poreziChildren.forEach((cat) => console.log(`   - ${cat.nameHr} (${cat.slug})`))
    console.log()

    // Test 5: Get category by ID
    console.log("Test 5: Get category by ID (pdv)")
    const pdvCategory = await drizzleDb
      .select()
      .from(newsCategories)
      .where(eq(newsCategories.id, "pdv"))
      .limit(1)
    if (pdvCategory.length > 0) {
      console.log(`✓ Found: ${pdvCategory[0].nameHr}`)
      console.log(`   Parent ID: ${pdvCategory[0].parentId}`)
      console.log(`   Slug: ${pdvCategory[0].slug}\n`)
    }

    // Test 6: Count categories by parent
    console.log("Test 6: Count categories by parent")
    const categoryCounts = await drizzleDb
      .select({
        parentId: newsCategories.parentId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(newsCategories)
      .groupBy(newsCategories.parentId)

    console.log("✓ Category counts:")
    categoryCounts.forEach((row) => {
      if (row.parentId === null) {
        console.log(`   - Root level: ${row.count} categories`)
      } else {
        console.log(`   - ${row.parentId}: ${row.count} subcategories`)
      }
    })
    console.log()

    // Test 7: Get category with specific color
    console.log("Test 7: Get categories with blue color scheme (#3b82f6)")
    const blueCategories = await drizzleDb
      .select()
      .from(newsCategories)
      .where(eq(newsCategories.color, "#3b82f6"))
    console.log(`✓ Found ${blueCategories.length} category/categories:`)
    blueCategories.forEach((cat) => console.log(`   - ${cat.nameHr}`))
    console.log()

    console.log("✅ All query tests passed!")

    process.exit(0)
  } catch (error) {
    console.error("❌ Error testing category queries:", error)
    process.exit(1)
  }
}

testCategoryQueries()
