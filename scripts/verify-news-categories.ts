#!/usr/bin/env tsx
// scripts/verify-news-categories.ts

import { drizzleDb } from "../src/lib/db/drizzle"
import { newsCategories } from "../src/lib/db/schema"
import { eq, isNull } from "drizzle-orm"

async function verifyNewsCategories() {
  console.log("🔍 Verifying news categories in database...\n")

  try {
    // Get all categories
    const allCategories = await drizzleDb
      .select()
      .from(newsCategories)
      .orderBy(newsCategories.sortOrder)

    // Get parent categories (top-level)
    const parentCategories = await drizzleDb
      .select()
      .from(newsCategories)
      .where(isNull(newsCategories.parentId))
      .orderBy(newsCategories.sortOrder)

    console.log(`📊 Total categories: ${allCategories.length}`)
    console.log(`📦 Parent categories: ${parentCategories.length}\n`)

    // Display hierarchical structure
    for (const parent of parentCategories) {
      console.log(`\n${parent.icon ? parent.icon : "📁"} ${parent.nameHr} (${parent.slug})`)
      console.log(`   ID: ${parent.id}`)
      console.log(`   Color: ${parent.color}`)
      console.log(`   Sort Order: ${parent.sortOrder}`)

      // Get children
      const children = await drizzleDb
        .select()
        .from(newsCategories)
        .where(eq(newsCategories.parentId, parent.id))
        .orderBy(newsCategories.sortOrder)

      if (children.length > 0) {
        console.log(`   Subcategories:`)
        for (const child of children) {
          console.log(
            `      ├─ ${child.icon ? child.icon : "📄"} ${child.nameHr} (${child.slug}) - ${child.color}`
          )
        }
      }
    }

    console.log("\n✅ Verification complete!")

    // Check for any orphaned categories (parent_id references non-existent parent)
    const orphaned = []
    for (const category of allCategories) {
      if (category.parentId) {
        const parentExists = allCategories.find((c) => c.id === category.parentId)
        if (!parentExists) {
          orphaned.push(category)
        }
      }
    }

    if (orphaned.length > 0) {
      console.log(`\n⚠️  Warning: ${orphaned.length} orphaned categories found:`)
      orphaned.forEach((cat) => {
        console.log(`   - ${cat.nameHr} (parent_id: ${cat.parentId} not found)`)
      })
    } else {
      console.log("\n✓ No orphaned categories - all parent references are valid")
    }

    process.exit(0)
  } catch (error) {
    console.error("❌ Error verifying news categories:", error)
    process.exit(1)
  }
}

verifyNewsCategories()
