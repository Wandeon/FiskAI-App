// src/lib/regulatory-truth/taxonomy/query-expansion.ts
import { db } from "@/lib/db"
import {
  getConceptWithRelations,
  getAncestors,
  getDescendants,
  findConceptsByTerm,
  type ConceptWithRelations,
} from "./concept-graph"

export interface ExpandedQuery {
  originalTerms: string[]
  expandedTerms: string[]
  matchedConcepts: string[]
  legalCategories: string[]
  vatCategories: string[]
}

/**
 * Expand query terms using taxonomy
 *
 * Given: "juice" (sok)
 * Returns: ["juice", "sok", "vocni sok", "bezalkoholno pice", "beverage"]
 */
export async function expandQueryConcepts(query: string): Promise<ExpandedQuery> {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)

  const result: ExpandedQuery = {
    originalTerms: terms,
    expandedTerms: [...terms],
    matchedConcepts: [],
    legalCategories: [],
    vatCategories: [],
  }

  const processedConcepts = new Set<string>()

  for (const term of terms) {
    // Find concepts matching this term
    const concepts = await findConceptsByTerm(term)

    for (const concept of concepts) {
      if (processedConcepts.has(concept.slug)) continue
      processedConcepts.add(concept.slug)

      result.matchedConcepts.push(concept.slug)

      // Add synonyms
      for (const synonym of concept.synonyms) {
        if (!result.expandedTerms.includes(synonym.toLowerCase())) {
          result.expandedTerms.push(synonym.toLowerCase())
        }
      }

      // Add hyponyms (more specific terms)
      for (const hyponym of concept.hyponyms) {
        if (!result.expandedTerms.includes(hyponym.toLowerCase())) {
          result.expandedTerms.push(hyponym.toLowerCase())
        }
      }

      // Add search terms
      for (const searchTerm of concept.searchTerms) {
        if (!result.expandedTerms.includes(searchTerm.toLowerCase())) {
          result.expandedTerms.push(searchTerm.toLowerCase())
        }
      }

      // Track legal categories
      if (concept.legalCategory && !result.legalCategories.includes(concept.legalCategory)) {
        result.legalCategories.push(concept.legalCategory)
      }

      // Track VAT categories
      if (concept.vatCategory && !result.vatCategories.includes(concept.vatCategory)) {
        result.vatCategories.push(concept.vatCategory)
      }

      // Expand to parent concepts (hypernyms)
      const ancestors = await getAncestors(concept.slug)
      for (const ancestor of ancestors) {
        if (processedConcepts.has(ancestor.slug)) continue
        processedConcepts.add(ancestor.slug)

        // Add ancestor's name as expanded term
        if (!result.expandedTerms.includes(ancestor.nameHr.toLowerCase())) {
          result.expandedTerms.push(ancestor.nameHr.toLowerCase())
        }

        // Track ancestor's legal category
        if (ancestor.legalCategory && !result.legalCategories.includes(ancestor.legalCategory)) {
          result.legalCategories.push(ancestor.legalCategory)
        }
      }
    }
  }

  return result
}

/**
 * Find rules by legal category
 */
export async function findRulesByLegalCategory(category: string): Promise<string[]> {
  // Find concepts with this legal category
  const concepts = await db.conceptNode.findMany({
    where: { legalCategory: category },
  })

  // Find rules linked to these concepts
  const ruleIds: string[] = []

  for (const concept of concepts) {
    const rules = await db.regulatoryRule.findMany({
      where: { conceptSlug: concept.slug },
      select: { id: true },
    })
    ruleIds.push(...rules.map((r) => r.id))
  }

  return [...new Set(ruleIds)]
}

/**
 * Find VAT rate for a product term
 */
export async function findVatCategoryForTerm(term: string): Promise<string | null> {
  const concepts = await findConceptsByTerm(term)

  for (const concept of concepts) {
    if (concept.vatCategory) {
      return concept.vatCategory
    }

    // Check ancestors
    const ancestors = await getAncestors(concept.slug)
    for (const ancestor of ancestors) {
      if (ancestor.vatCategory) {
        return ancestor.vatCategory
      }
    }
  }

  return null
}
