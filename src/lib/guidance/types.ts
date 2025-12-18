// src/lib/guidance/types.ts
// Client-safe types (no database imports)

import { GuidanceCategory } from "./constants"

// Urgency levels for checklist items
export const URGENCY_LEVELS = {
  CRITICAL: "critical", // Overdue or due today
  SOON: "soon", // Due within 3 days
  UPCOMING: "upcoming", // Due within 7 days
  OPTIONAL: "optional", // Suggestions, no deadline
} as const

export type UrgencyLevel = (typeof URGENCY_LEVELS)[keyof typeof URGENCY_LEVELS]

// Action types for checklist items
export const ACTION_TYPES = {
  LINK: "link",
  WIZARD: "wizard",
  QUICK_ACTION: "quick_action",
} as const

// Checklist item types (matching schema)
export const CHECKLIST_ITEM_TYPES = {
  DEADLINE: "deadline",
  PAYMENT: "payment",
  ACTION: "action",
  ONBOARDING: "onboarding",
  SEASONAL: "seasonal",
  SUGGESTION: "suggestion",
} as const

export interface ChecklistItem {
  id: string
  category: GuidanceCategory
  type: (typeof CHECKLIST_ITEM_TYPES)[keyof typeof CHECKLIST_ITEM_TYPES]
  title: string
  description: string
  dueDate?: Date
  urgency: UrgencyLevel
  action: {
    type: (typeof ACTION_TYPES)[keyof typeof ACTION_TYPES]
    href?: string
    wizardId?: string
  }
  reference: string // For tracking interactions (e.g., "obligation:abc123")
}
