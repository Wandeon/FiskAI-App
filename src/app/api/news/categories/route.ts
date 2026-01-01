import { NextResponse } from "next/server"
import { drizzleDb } from "@/lib/db/drizzle"
import { newsCategories } from "@/lib/db/schema/news"
import { asc } from "drizzle-orm"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

export const dynamic = "force-dynamic"

/**
 * GET /api/news/categories
 *
 * Returns category tree for navigation
 * Top-level categories with their children
 */
export async function GET() {
  try {
    // Fetch all categories ordered by sort_order
    const allCategories = await drizzleDb
      .select({
        id: newsCategories.id,
        slug: newsCategories.slug,
        nameHr: newsCategories.nameHr,
        parentId: newsCategories.parentId,
        icon: newsCategories.icon,
        color: newsCategories.color,
        sortOrder: newsCategories.sortOrder,
      })
      .from(newsCategories)
      .orderBy(asc(newsCategories.sortOrder), asc(newsCategories.nameHr))

    // Build category tree
    const categoryMap = new Map()
    const rootCategories: any[] = []

    // First pass: create map of all categories
    allCategories.forEach((category) => {
      categoryMap.set(category.id, {
        ...category,
        children: [],
      })
    })

    // Second pass: build tree structure
    allCategories.forEach((category) => {
      const categoryWithChildren = categoryMap.get(category.id)
      if (category.parentId) {
        const parent = categoryMap.get(category.parentId)
        if (parent) {
          parent.children.push(categoryWithChildren)
        }
      } else {
        rootCategories.push(categoryWithChildren)
      }
    })

    return NextResponse.json({
      categories: rootCategories,
      flat: allCategories,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("Error fetching categories:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
