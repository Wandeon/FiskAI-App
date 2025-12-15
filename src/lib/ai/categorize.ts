import { db } from '@/lib/db'
import { CategorySuggestion } from './types'

// Simple keyword-based categorization (no AI needed)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'OFFICE': ['papir', 'toner', 'uredski', 'office', 'printer', 'pisač', 'olovka', 'bilježnica'],
  'TRAVEL': ['gorivo', 'benzin', 'diesel', 'cestarina', 'parking', 'put', 'autoprevoz'],
  'TELECOM': ['mobitel', 'internet', 'telefon', 'a1', 'tele2', 'telemach', 'telekom'],
  'RENT': ['najam', 'zakup', 'rent', 'naknada', 'prostor'],
  'UTILITIES': ['struja', 'voda', 'plin', 'hep', 'komunalije', 'grijanje', 'hlađenje'],
  'SERVICES': ['usluga', 'servis', 'održavanje', 'consulting', 'savjetovanje', 'podrška'],
  'MARKETING': ['marketing', 'reklama', 'promocija', 'oglas', 'advertising'],
  'FOOD': ['restoran', 'hrana', 'piće', 'kava', 'obrok', 'restaurant', 'catering'],
  'TRANSPORT': ['prijevoz', 'transport', 'dostava', 'kurir', 'shipping'],
  'EQUIPMENT': ['oprema', 'alat', 'uređaj', 'equipment', 'tool', 'stroj'],
  'SOFTWARE': ['software', 'licenca', 'pretplata', 'subscription', 'aplikacija', 'program'],
  'INSURANCE': ['osiguranje', 'polica', 'insurance', 'premija'],
}

export async function suggestCategory(
  description: string,
  companyId: string
): Promise<CategorySuggestion[]> {
  const categories = await db.expenseCategory.findMany({
    where: { OR: [{ companyId }, { companyId: null }] }
  })

  const descLower = description.toLowerCase()
  const suggestions: CategorySuggestion[] = []

  for (const cat of categories) {
    const keywords = CATEGORY_KEYWORDS[cat.code] || []
    const matches = keywords.filter(kw => descLower.includes(kw))

    if (matches.length > 0) {
      const matchedWords = matches.slice(0, 3).join(', ')
      suggestions.push({
        categoryId: cat.id,
        categoryName: cat.name,
        confidence: Math.min(matches.length * 0.3, 0.9),
        reason: `Prepoznate ključne riječi: ${matchedWords}`,
      })
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3)
}

export async function suggestCategoryByVendor(
  vendorName: string,
  companyId: string
): Promise<CategorySuggestion | null> {
  // First, find the contact/vendor by name
  const contact = await db.contact.findFirst({
    where: {
      companyId,
      name: {
        contains: vendorName,
        mode: 'insensitive'
      }
    }
  })

  if (!contact) return null

  // Find previous expenses from the same vendor
  const previousExpense = await db.expense.findFirst({
    where: {
      companyId,
      vendorId: contact.id
    },
    include: {
      category: true
    },
    orderBy: {
      date: 'desc'
    }
  })

  if (previousExpense?.category) {
    return {
      categoryId: previousExpense.category.id,
      categoryName: previousExpense.category.name,
      confidence: 0.95,
      reason: `Prethodno korišteno za "${contact.name}"`,
    }
  }

  return null
}
