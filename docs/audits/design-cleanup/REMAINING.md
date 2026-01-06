# Remaining Raw Palette Violations

**Generated:** 2026-01-06
**Updated:** 2026-01-06 (Quarantine Hardening Complete)
**Total:** 103 violations in quarantine, 0 outside

---

## Quarantine Summary

| Quarantine Folder | Status |
|-------------------|--------|
| src/components/news/ | QUARANTINED |
| src/components/assistant-v2/ | QUARANTINED |
| src/components/marketing/ | QUARANTINED |
| src/components/knowledge-hub/ | QUARANTINED |
| src/components/ui/command-palette/ | QUARANTINED |
| src/app/(marketing)/ | QUARANTINED |

**Enforcement:**
- ESLint: `error` everywhere, `warn` in quarantine only
- CI Script: `scripts/check-raw-palette.mjs` (cap: 103)

---

## Sample Violations by Category

---

## Detailed Violations

### news/ (14 violations)

| File | Line | Pattern | Class |
|------|------|---------|-------|
| DigestBanner.tsx | 21 | hover | `hover:border-cyan-500/50` |
| NewsSearch.tsx | 199 | hover | `group-hover:text-cyan-300` |
| CategorySection.tsx | 38 | hover | `hover:text-cyan-300` |
| NewsCard.tsx | 39 | text | `text-blue-300` |
| NewsCard.tsx | 45 | text | `text-green-300` |
| NewsCard.tsx | 62 | hover | `hover:text-blue-300` |
| NewsletterSignup.tsx | 64 | focus | `focus:border-cyan-500/50` |
| PostCard.tsx | 21 | text | `text-red-300` |
| PostCard.tsx | 23 | text | `text-green-300` |
| PostCard.tsx | 63 | text | `text-blue-300` |
| NewsMarkdown.tsx | 14 | prose | `prose-code:text-blue-300` |
| NewsMarkdown.tsx | 31 | hover | `hover:text-blue-300` |
| SocialShare.tsx | 92 | border | `border-emerald-500/50` |
| LatestNewsSection.tsx | 43 | hover | `group-hover:border-blue-300` |

### assistant-v2/ (17 violations)

| File | Line | Pattern | Class |
|------|------|---------|-------|
| AuthorityBadge.tsx | 21 | bg/text | `bg-blue-900/30 text-blue-300` |
| AuthorityBadge.tsx | 22 | bg/text | `bg-green-900/30 text-green-300` |
| AnswerSection.tsx | 44 | dark | `dark:bg-blue-950/20` |
| AnswerSection.tsx | 45 | bg | `bg-blue-900/20` |
| AnswerSection.tsx | 50 | dark | `dark:bg-amber-950/20` |
| AnswerSection.tsx | 51 | bg | `bg-amber-900/20` |
| AnswerSection.tsx | 56 | dark | `dark:bg-blue-950/20` |
| AnswerSection.tsx | 57 | bg | `bg-cyan-900/20` |
| AnswerSection.tsx | 167 | bg | `bg-red-950/30` |
| AnswerSection.tsx | 292 | border | `border-cyan-500/20` |
| AnswerSection.tsx | 293 | text | `text-cyan-200` |
| SourceCard.tsx | 63 | bg | `bg-amber-900/30` |
| ClientDataPanel.tsx | 211 | bg | `bg-amber-900/20` |
| AssistantContainer.tsx | 228 | border | `border-cyan-500/20` |
| SuggestionChips.tsx | 115 | border | `border-cyan-500/20` |
| SuggestionChips.tsx | 116 | text | `text-cyan-200` |
| SuggestionChips.tsx | 119 | hover | `hover:text-cyan-100` |

### marketing/ (19 violations)

| File | Line | Pattern | Class |
|------|------|---------|-------|
| PortalNavigation.tsx | 376 | bg | `bg-red-400` |
| Fiskalizacija2Wizard.tsx | 456 | hover | `hover:border-blue-300` |
| MiniDemos.tsx | 178 | bg | `bg-green-600` |
| MiniDemos.tsx | 206 | bg | `bg-green-600` |
| PortalCard.tsx | 144 | bg | `bg-red-400` |
| MarketingHeader.tsx | 52 | bg | `bg-slate-950/85` |
| MarketingHeader.tsx | 143 | bg | `bg-slate-950/90` |
| MarketingHomeClient.tsx | 61 | bg | `bg-blue-500/20` |
| MarketingHomeClient.tsx | 85 | bg | `bg-cyan-500/10` |
| MarketingHomeClient.tsx | 116 | multiple | `border-cyan-400/30 bg-cyan-500/10 text-cyan-300` |
| MarketingHomeClient.tsx | 181 | multiple | `border-cyan-400/30 bg-cyan-500/10 text-cyan-200` |
| MarketingHomeClient.tsx | 441 | hover | `group-hover:border-blue-300` |
| MarketingHomeClient.tsx | 506 | hover | `group-hover:border-blue-300` |
| WorkflowScroller.tsx | 118 | bg | `bg-red-400/80` |
| WorkflowScroller.tsx | 120 | bg | `bg-green-400/80` |
| MarketingPricingClient.tsx | 60 | text | `text-cyan-300` |
| MarketingPricingClient.tsx | 169 | border | `border-cyan-500` |
| MarketingPricingClient.tsx | 408 | border | `border-cyan-500/30` |
| QuickAccessToolbar.tsx | 178 | hover | `hover:border-blue-300` |

---

## Pattern Analysis

| Pattern Type | Count | Common Classes |
|--------------|-------|----------------|
| Dark mode bg (bg-*-900/*, bg-*-950/*) | 12 | blue-900, amber-900, cyan-900, red-950 |
| Light text (text-*-300, text-*-200) | 14 | cyan-300, blue-300, green-300, cyan-200 |
| Hover states | 10 | hover:text-cyan-300, hover:border-blue-300 |
| Border accents | 8 | border-cyan-500/*, border-emerald-500/* |
| Decorative bg | 6 | bg-green-600, bg-red-400, bg-slate-950 |

---

## Justification Required for Quarantine

Each file MUST have `@design-override` with specific reason:

1. **Dark-mode HUD aesthetic** (assistant-v2/) - Cockpit UI requires explicit dark backgrounds
2. **Marketing hero visuals** (marketing/) - Landing page gradients require raw values
3. **News dark-first UI** (news/) - News cards designed for dark backgrounds

Files without valid justification must be migrated to tokens.
