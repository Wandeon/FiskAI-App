// src/lib/guidance/help-density.ts

import type { CompetenceLevel } from "@/lib/visibility/rules"

export interface HelpDensityConfig {
  fieldTooltips: "all" | "key" | "none"
  actionConfirmations: "always" | "destructive" | "never"
  successExplanations: "detailed" | "brief" | "toast"
  keyboardShortcuts: "hidden" | "hover" | "visible"
}

export const HELP_DENSITY: Record<CompetenceLevel, HelpDensityConfig> = {
  beginner: {
    fieldTooltips: "all",
    actionConfirmations: "always",
    successExplanations: "detailed",
    keyboardShortcuts: "hidden",
  },
  average: {
    fieldTooltips: "key",
    actionConfirmations: "destructive",
    successExplanations: "brief",
    keyboardShortcuts: "hover",
  },
  pro: {
    fieldTooltips: "none",
    actionConfirmations: "never",
    successExplanations: "toast",
    keyboardShortcuts: "visible",
  },
}

export function getHelpDensity(competence: CompetenceLevel): HelpDensityConfig {
  return HELP_DENSITY[competence]
}

export const COMPETENCE_DESCRIPTIONS: Record<CompetenceLevel, string> = {
  beginner: "Detaljni tooltipovi na svim poljima, potvrde za sve važne radnje, i objašnjenja nakon svake operacije.",
  average: "Tooltipovi samo na ključnim poljima, potvrde samo za kritične radnje, i kratke obavijesti o uspjehu.",
  pro: "Bez tooltipova, bez potvrdi, i vidljive tipkovničke prečace za brži rad.",
}
