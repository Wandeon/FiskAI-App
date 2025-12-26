// src/lib/regulatory-truth/taxonomy/concept-graph.ts
import { db } from "@/lib/db"
import type { ConceptNode } from "@prisma/client"

// Base type from Prisma
type ConceptNodeBase = ConceptNode

// Extend with relations - parent and children are recursive
export interface ConceptWithRelations extends ConceptNodeBase {
  parent: ConceptWithRelations | null
  children: ConceptWithRelations[]
}

/**
 * Get a concept with all its relations (parent, children)
 */
export async function getConceptWithRelations(slug: string): Promise<ConceptWithRelations | null> {
  const concept = await db.conceptNode.findUnique({
    where: { slug },
    include: {
      parent: true,
      children: true,
    },
  })

  if (!concept) return null

  return concept as ConceptWithRelations
}

/**
 * Get all ancestors of a concept (parent -> grandparent -> ...)
 */
export async function getAncestors(slug: string): Promise<ConceptWithRelations[]> {
  const ancestors: ConceptWithRelations[] = []
  let current = await getConceptWithRelations(slug)

  while (current?.parent) {
    const parent = await getConceptWithRelations(current.parent.slug)
    if (parent) {
      ancestors.push(parent)
      current = parent
    } else {
      break
    }
  }

  return ancestors
}

/**
 * Get all descendants of a concept (children -> grandchildren -> ...)
 */
export async function getDescendants(slug: string): Promise<ConceptWithRelations[]> {
  const descendants: ConceptWithRelations[] = []
  const queue: string[] = [slug]
  const visited = new Set<string>()

  while (queue.length > 0) {
    const currentSlug = queue.shift()!
    if (visited.has(currentSlug)) continue
    visited.add(currentSlug)

    const concept = await getConceptWithRelations(currentSlug)
    if (!concept) continue

    for (const child of concept.children) {
      if (!visited.has(child.slug)) {
        descendants.push(child as ConceptWithRelations)
        queue.push(child.slug)
      }
    }
  }

  return descendants
}

/**
 * Find concepts matching a search term (checks synonyms, hyponyms, searchTerms)
 */
export async function findConceptsByTerm(term: string): Promise<ConceptWithRelations[]> {
  const normalizedTerm = term.toLowerCase().trim()

  // Search in multiple fields
  const concepts = await db.conceptNode.findMany({
    where: {
      OR: [
        { slug: { contains: normalizedTerm, mode: "insensitive" } },
        { nameHr: { contains: normalizedTerm, mode: "insensitive" } },
        { nameEn: { contains: normalizedTerm, mode: "insensitive" } },
        { synonyms: { has: normalizedTerm } },
        { hyponyms: { has: normalizedTerm } },
        { searchTerms: { has: normalizedTerm } },
        { legalCategory: { contains: normalizedTerm, mode: "insensitive" } },
      ],
    },
    include: {
      parent: true,
      children: true,
    },
  })

  return concepts as ConceptWithRelations[]
}

/**
 * Get the legal category chain for a concept (walks up to root)
 */
export async function getLegalCategoryChain(slug: string): Promise<string[]> {
  const categories: string[] = []
  let current = await getConceptWithRelations(slug)

  while (current) {
    if (current.legalCategory) {
      categories.push(current.legalCategory)
    }
    if (current.parent) {
      current = await getConceptWithRelations(current.parent.slug)
    } else {
      break
    }
  }

  return categories
}
