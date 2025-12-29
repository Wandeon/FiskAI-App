# Component Inventory and Consolidation Plan

> **Status:** Draft
> **Created:** 2025-12-29
> **Issue:** #236
> **Author:** System Audit

## Executive Summary

This document provides a comprehensive inventory of all components in the FiskAI codebase and identifies consolidation opportunities. The component library has grown organically to **305 component files** across **63 directories**, with several architectural inconsistencies that should be addressed.

### Key Findings

- **Duplicate Components:** 3 core primitives exist in both `ui/` and `ui/primitives/`
- **Misplaced Components:** 4+ domain-specific components incorrectly placed in `ui/`
- **Layer Violations:** Several components don't follow the architectural layer model
- **Import Pattern:** 146 imports use `ui/button`, only 11 use `ui/primitives/button`

## Component Architecture Overview

Per `CLAUDE.md`, FiskAI uses a 4-layer component system:

```
ui/ + motion/ → patterns/ → sections/ → templates/ → pages
```

**Rule:** Each layer can only import from layers to its left.

## Complete Component Inventory

### Layer 0: UI Primitives (`src/components/ui/`)

**Purpose:** Atomic, reusable components with design token integration

**Component Count:** 43 files

#### Core Primitives

| Component | File           | Status       | Notes                           |
| --------- | -------------- | ------------ | ------------------------------- |
| Alert     | `alert.tsx`    | ✅ Good      | Uses design tokens              |
| Badge     | `badge.tsx`    | ⚠️ Duplicate | Also in `primitives/badge.tsx`  |
| Button    | `button.tsx`   | ⚠️ Duplicate | Also in `primitives/button.tsx` |
| Card      | `card.tsx`     | ⚠️ Duplicate | Also in `primitives/card.tsx`   |
| Input     | `input.tsx`    | ✅ Good      |                                 |
| Label     | `label.tsx`    | ✅ Good      |                                 |
| Select    | `select.tsx`   | ✅ Good      |                                 |
| Switch    | `switch.tsx`   | ✅ Good      |                                 |
| Textarea  | `textarea.tsx` | ✅ Good      |                                 |
| Tooltip   | `tooltip.tsx`  | ✅ Good      |                                 |

#### Form Components

| Component    | File               | Status       | Notes            |
| ------------ | ------------------ | ------------ | ---------------- |
| Combobox     | `combobox.tsx`     | ✅ Good      |                  |
| Multi-Select | `multi-select.tsx` | ✅ Good      |                  |
| OIB Input    | `oib-input.tsx`    | ❌ Misplaced | Move to `forms/` |

#### Feedback Components

| Component       | File                  | Status  | Notes |
| --------------- | --------------------- | ------- | ----- |
| Modal           | `modal.tsx`           | ✅ Good |       |
| Confirm Dialog  | `confirm-dialog.tsx`  | ✅ Good |       |
| Empty State     | `empty-state.tsx`     | ✅ Good |       |
| Loading Spinner | `loading-spinner.tsx` | ✅ Good |       |
| Loading State   | `LoadingState.tsx`    | ✅ Good |       |
| Skeleton        | `skeleton.tsx`        | ✅ Good |       |
| Progress        | `progress.tsx`        | ✅ Good |       |
| Progress Bar    | `progress-bar.tsx`    | ✅ Good |       |

#### Navigation Components

| Component     | File                | Status  | Notes |
| ------------- | ------------------- | ------- | ----- |
| Dropdown Menu | `dropdown-menu.tsx` | ✅ Good |       |
| Smart Link    | `smart-link.tsx`    | ✅ Good |       |

#### Data Display

| Component        | File                   | Status       | Notes                               |
| ---------------- | ---------------------- | ------------ | ----------------------------------- |
| Table            | `table.tsx`            | ✅ Good      |                                     |
| Data Table       | `data-table.tsx`       | ✅ Good      |                                     |
| Responsive Table | `responsive-table.tsx` | ✅ Good      |                                     |
| Stat Card        | `stat-card.tsx`        | ❌ Misplaced | Move to `dashboard/` or `patterns/` |

#### Layout Components

| Component   | File              | Status  | Notes |
| ----------- | ----------------- | ------- | ----- |
| Page Card   | `page-card.tsx`   | ✅ Good |       |
| Mobile Card | `mobile-card.tsx` | ✅ Good |       |

#### Domain-Specific (Misplaced in UI)

| Component          | File                     | Status       | Recommended Location               |
| ------------------ | ------------------------ | ------------ | ---------------------------------- |
| Glossary Term      | `glossary-term.tsx`      | ❌ Misplaced | Move to `content/`                 |
| Competence Tooltip | `competence-tooltip.tsx` | ❌ Misplaced | Move to `guidance/`                |
| Next Steps         | `next-steps.tsx`         | ❌ Misplaced | Move to `guidance/` or `patterns/` |

#### Specialized Components

| Component                 | File                            | Status  | Notes                  |
| ------------------------- | ------------------------------- | ------- | ---------------------- |
| Notification Center       | `notification-center.tsx`       | ✅ Good |                        |
| Keyboard Shortcuts Dialog | `keyboard-shortcuts-dialog.tsx` | ✅ Good |                        |
| Keyboard Shortcut         | `keyboard-shortcut.tsx`         | ✅ Good |                        |
| Deprecation Notice        | `deprecation-notice.tsx`        | ✅ Good |                        |
| FAB                       | `fab.tsx`                       | ✅ Good | Floating Action Button |

#### Branding

| Component   | File             | Status  | Notes |
| ----------- | ---------------- | ------- | ----- |
| Logo        | `Logo.tsx`       | ✅ Good |       |
| Logo Symbol | `LogoSymbol.tsx` | ✅ Good |       |

#### Sub-directories

**`ui/command-palette/`** (5 files) ✅ Good

- `CommandPalette.tsx`
- `CommandItem.tsx`
- `CommandResults.tsx`
- `useCommandPalette.ts`
- `index.ts`

**`ui/motion/`** (3 files) ✅ Good

- `FadeIn.tsx`
- `HoverScale.tsx`
- `GlowOrb.tsx`

**`ui/patterns/`** (3 files) ⚠️ Confusing - Should merge with `/patterns/`

- `GlassCard.tsx`
- `GradientButton.tsx`
- `SectionBackground.tsx`

**`ui/primitives/`** (5 files) ❌ DUPLICATE - Remove or consolidate

- `badge.tsx` - 1,389 bytes
- `button.tsx` - 1,872 bytes
- `card.tsx` - 2,607 bytes
- `index.ts`
- `badge-examples.md`

### Layer 1: Motion (`src/components/motion/`)

**Purpose:** Animation behaviors and motion patterns

**Component Count:** 2 files

| Component | File          | Status  | Notes                |
| --------- | ------------- | ------- | -------------------- |
| Reveal    | `Reveal.tsx`  | ✅ Good | Animation wrapper    |
| Stagger   | `Stagger.tsx` | ✅ Good | Staggered animations |

**Note:** 3 additional motion components exist in `ui/motion/` - consider consolidating.

### Layer 2: Patterns (`src/components/patterns/`)

**Purpose:** Composed primitives forming reusable patterns

**Component Count:** 4 files

| Component       | File                 | Status  | Notes |
| --------------- | -------------------- | ------- | ----- |
| Feature Card    | `FeatureCard.tsx`    | ✅ Good |       |
| Icon Badge      | `IconBadge.tsx`      | ✅ Good |       |
| Section Heading | `SectionHeading.tsx` | ✅ Good |       |
| Index           | `index.ts`           | ✅ Good |       |

**Recommendation:** Merge `ui/patterns/` components here.

### Layer 3: Sections (`src/components/sections/`)

**Purpose:** Page sections composed of patterns

**Component Count:** 4 files

| Component    | File              | Status  | Notes |
| ------------ | ----------------- | ------- | ----- |
| CTA Section  | `CTASection.tsx`  | ✅ Good |       |
| Feature Grid | `FeatureGrid.tsx` | ✅ Good |       |
| Hero Section | `HeroSection.tsx` | ✅ Good |       |
| Index        | `index.ts`        | ✅ Good |       |

### Layer 4: Templates (`src/components/templates/`)

**Purpose:** Portal-scoped page templates

**Component Count:** 2 files + 1 subdirectory

| Component | File       | Status  | Notes |
| --------- | ---------- | ------- | ----- |
| Index     | `index.ts` | ✅ Good |       |

**`templates/marketing/`** (2 files)

- `MarketingPageTemplate.tsx`
- `index.ts`

## Domain-Specific Components

### Accessibility (`src/components/a11y/`)

**Count:** 1 file

- `skip-link.tsx` ✅

### Admin Portal (`src/components/admin/`)

**Count:** 9 files + news subdirectory

- `admin-header-wrapper.tsx`
- `admin-sidebar.tsx`
- `alerts-panel.tsx`
- `dashboard.tsx`
- `header.tsx`
- `sidebar.tsx`
- `staff-management.tsx`
- `tenants-list.tsx`
- `news/PostEditorClient.tsx`

### AI Features (`src/components/ai/`)

**Count:** 2 files

- `ai-feedback.tsx`
- `ai-stats-widget.tsx`

### Assistant v1 (`src/components/assistant/`)

**Count:** 5 files

- `AssistantContext.tsx`
- `AssistantPopup.tsx`
- `ConditionalAnswerCard.tsx`
- `ReasoningStepper.tsx`
- `RefusalCard.tsx`

### Assistant v2 (`src/components/assistant-v2/`)

**Count:** 24 files + reasoning subdirectory

**Main Components:**

- `ActionButtons.tsx`
- `Announcer.tsx`
- `AnswerCard.tsx`
- `AnswerSection.tsx`
- `AnswerSkeleton.tsx`
- `AssistantContainer.tsx`
- `AssistantInput.tsx`
- `AuthorityBadge.tsx`
- `ClientDataPanel.tsx`
- `ConfidenceBadge.tsx`
- `ConflictBanner.tsx`
- `CTABlock.tsx`
- `DataPointList.tsx`
- `EmptyState.tsx`
- `ErrorCard.tsx`
- `EvidencePanel.tsx`
- `HistoryBar.tsx`
- `PersonalizationPanel.tsx`
- `RefusalCard.tsx`
- `RelatedQuestions.tsx`
- `SourceCard.tsx`
- `SuggestionChips.tsx`
- `SupportingSources.tsx`
- `WhyDrawer.tsx`
- `index.ts`

**`reasoning/`** subdirectory (6 files):

- `MorphingPill.tsx`
- `ReasoningAssistantContainer.tsx`
- `ReasoningCard.tsx`
- `ReasoningStepper.tsx`
- `StageStep.tsx`
- `TerminalAnswerCard.tsx`
- `index.ts`

### Authentication (`src/components/auth/`)

**Count:** 11 files + steps subdirectory

**Main Components:**

- `AnimatedButton.tsx`
- `AuroraBackground.tsx`
- `AuthFlow.tsx`
- `FloatingOrbs.tsx`
- `GlassCard.tsx`
- `OTPInput.tsx`
- `useAuthFlow.ts`
- `types.ts`
- `index.ts`

**`steps/`** subdirectory (7 files):

- `AuthenticateStep.tsx`
- `IdentifyStep.tsx`
- `RegisterStep.tsx`
- `ResetStep.tsx`
- `SuccessStep.tsx`
- `VerifyStep.tsx`
- `index.ts`

### Beta Features (`src/components/beta/`)

**Count:** 3 files

- `beta-badge.tsx`
- `beta-feedback-widget.tsx`
- `index.ts`

### Compliance (`src/components/compliance/`)

**Count:** 1 file

- `compliance-badge.tsx`

### Contacts (`src/components/contacts/`)

**Count:** 3 files

- `contact-card.tsx`
- `contact-filters.tsx`
- `contact-skeleton.tsx`

### Content (`src/components/content/`)

**Count:** 8 files

- `ai-answer-block.tsx`
- `FAQ.tsx`
- `GlossaryCard.tsx`
- `HowToSteps.tsx`
- `QuickAnswer.tsx`
- `RegulatorySection.tsx`
- `Sources.tsx`
- `index.ts`

### Corporate Tax (`src/components/corporate-tax/`)

**Count:** 1 file

- `corporate-tax-dashboard.tsx`

### Dashboard (`src/components/dashboard/`)

**Count:** 15 files

- `action-cards.tsx`
- `alert-banner.tsx`
- `compliance-status-card.tsx`
- `deadline-countdown-card.tsx`
- `fiscalization-status.tsx`
- `hero-banner.tsx`
- `insights-card.tsx`
- `invoice-funnel-card.tsx`
- `onboarding-checklist.tsx`
- `pausalni-status-card.tsx`
- `quick-stats.tsx`
- `recent-activity.tsx`
- `revenue-trend-card.tsx`
- `today-actions-card.tsx`
- `vat-overview-card.tsx`

**Note:** Multiple card components - consider consolidating patterns.

### Documents (`src/components/documents/`)

**Count:** 5 files

- `category-cards.tsx`
- `compact-dropzone.tsx`
- `documents-client.tsx`
- `new-document-dropdown.tsx`
- `reports-sidebar.tsx`

### Errors (`src/components/errors/`)

**Count:** 1 file

- `error-display.tsx`

### Expenses (`src/components/expenses/` and `src/components/expense/`)

**Count:** 5 files across 2 directories

**`expenses/`:**

- `expense-filters.tsx`
- `expense-inline-status.tsx`

**`expense/`:**

- `receipt-scanner.tsx`
- `receipt-scanner-with-feedback.tsx`

**Note:** Two directories for expenses - should consolidate.

### Fiscal (`src/components/fiscal/`)

**Count:** 2 files

- `FiscalValue.tsx`
- `index.ts`

### Forms (`src/components/forms/`)

**Count:** 1 file

- `turnstile-widget.tsx`

**Recommendation:** Move `ui/oib-input.tsx` here.

### Guidance (`src/components/guidance/`)

**Count:** 9 files

- `ChecklistItem.tsx`
- `ChecklistMiniView.tsx`
- `ChecklistWidget.tsx`
- `CompetenceSelector.tsx`
- `HelpTooltip.tsx`
- `InsightsWidget.tsx`
- `QuickLevelToggle.tsx`
- `index.ts`

**Recommendation:** Move `ui/competence-tooltip.tsx` and `ui/next-steps.tsx` here.

### Import (`src/components/import/`)

**Count:** 9 files

- `confirmation-modal.tsx`
- `document-scanner.tsx`
- `invoice-editor.tsx`
- `pdf-viewer.tsx`
- `processing-card.tsx`
- `processing-queue.tsx`
- `smart-dropzone.tsx`
- `transaction-editor.tsx`

### Invoice (`src/components/invoice/`)

**Count:** 5 files

- `invoice-pdf-preview.tsx`
- `invoice-step-indicator.tsx`
- `invoice-summary.tsx`
- `line-item-table.tsx`
- `product-picker.tsx`

### Invoices (`src/components/invoices/`)

**Count:** 1 file

- `invoice-filters.tsx`

**Note:** Two directories for invoices - should consolidate or clarify naming.

### Knowledge Hub (`src/components/knowledge-hub/`)

**Count:** 31 files across 5 subdirectories

**Main:**

- `mdx-components.tsx`
- `NextSteps.tsx`

**`calculators/`** (4 files):

- `ContributionCalculator.tsx`
- `PaymentSlipGenerator.tsx`
- `PDVThresholdCalculator.tsx`
- `TaxCalculator.tsx`

**`charts/`** (1 file):

- `BreakdownBars.tsx`

**`comparison/`** (8 files):

- `ComparisonCalculator.tsx`
- `ComparisonCell.tsx`
- `ComparisonPageContent.tsx`
- `ComparisonRow.tsx`
- `ComparisonTable.tsx`
- `QuickDecisionQuiz.tsx`
- `RecommendationCard.tsx`
- `index.ts`

**`guide/`** (13 files):

- `AccordionFAQ.tsx`
- `FAQ.tsx`
- `GuidesExplorer.tsx`
- `GuideUpsellSection.tsx`
- `PDVCallout.tsx`
- `PersonalizedSection.tsx`
- `ProsCons.tsx`
- `QuickStatsBar.tsx`
- `TableOfContents.tsx`
- `TLDRBox.tsx`
- `ToolUpsellCard.tsx`
- `VariantTabs.tsx`
- `index.ts`

**`tools/`** (2 files):

- `DeadlineCalendar.tsx`
- `index.ts`

**`wizard/`** (1 file):

- `WizardContainer.tsx`

### Layout (`src/components/layout/`)

**Count:** 13 files

- `bottom-nav.tsx`
- `company-switcher.tsx`
- `DashboardBackground.tsx`
- `feature-guard.tsx`
- `header-actions.tsx`
- `header.tsx`
- `logout-button.tsx`
- `mobile-action-bar.tsx`
- `mobile-nav.tsx`
- `offline-indicator.tsx`
- `onboarding-progress-pill.tsx`
- `plan-badge.tsx`
- `sidebar.tsx`

### Marketing (`src/components/marketing/`)

**Count:** 24 files

- `AuroraBackground.tsx`
- `ComplianceProgressBar.tsx`
- `ComplianceTrafficLight.tsx`
- `CountdownTimer.tsx`
- `CountUp.tsx`
- `FaqAccordion.tsx`
- `FeatureStoryScroller.tsx`
- `Fiskalizacija2Wizard.tsx`
- `LifecycleSelector.tsx`
- `marketing-analytics-init.tsx`
- `MarketingFeaturesClient.tsx`
- `MarketingHeader.tsx`
- `MarketingHomeClient.tsx`
- `MarketingMedia.tsx`
- `MarketingPricingClient.tsx`
- `MiniAssistant.tsx`
- `MiniDemos.tsx`
- `PlexusBackground.tsx`
- `PortalCard.tsx`
- `PortalNavigation.tsx`
- `QuickAccessToolbar.tsx`
- `SwitchProviderCTA.tsx`
- `WorkflowScroller.tsx`

**Note:** `AuroraBackground.tsx` duplicates `auth/AuroraBackground.tsx`.

### News (`src/components/news/`)

**Count:** 12 files

- `CategorySection.tsx`
- `DigestBanner.tsx`
- `HeroSection.tsx`
- `ImageWithAttribution.tsx`
- `NewsCard.tsx`
- `NewsletterSignup.tsx`
- `NewsList.tsx`
- `NewsMarkdown.tsx`
- `NewsSearch.tsx`
- `PostCard.tsx`
- `SocialShare.tsx`
- `ViewTracker.tsx`

### Onboarding (`src/components/onboarding/`)

**Count:** 6 files

- `step-address.tsx`
- `step-basic-info.tsx`
- `step-competence.tsx`
- `step-contact-tax.tsx`
- `step-indicator.tsx`
- `step-pausalni-profile.tsx`

### Pausalni (`src/components/pausalni/`)

**Count:** 9 files

- `batch-payment-slips.tsx`
- `eu-transaction-review.tsx`
- `form-generator-dialog.tsx`
- `notification-preferences.tsx`
- `obligation-timeline.tsx`
- `pausalni-dashboard.tsx`
- `payment-slip-modal.tsx`
- `posd-wizard.tsx`
- `index.ts`

### Products (`src/components/products/`)

**Count:** 3 files

- `product-csv-import.tsx`
- `product-health.tsx`
- `product-table.tsx`

### Providers (`src/components/providers/`)

**Count:** 1 file

- `analytics-provider.tsx`

### Reports (`src/components/reports/`)

**Count:** 1 file

- `accounting-export-form.tsx`

### SEO (`src/components/seo/`)

**Count:** 1 file

- `JsonLd.tsx`

### Settings (`src/components/settings/`)

**Count:** 1 file

- `passkey-manager.tsx`

### Skeletons (`src/components/skeletons/`)

**Count:** 6 files

- `card-skeleton.tsx`
- `dashboard-skeleton.tsx`
- `marketing-skeleton.tsx`
- `page-skeleton.tsx`
- `table-skeleton.tsx`
- `index.ts`

### Staff Portal (`src/components/staff/`)

**Count:** 10 files

- `client-context-header.tsx`
- `client-messages.tsx`
- `clients-list.tsx`
- `clients-search.tsx`
- `dashboard.tsx`
- `header.tsx`
- `invitation-form.tsx`
- `invitations-list.tsx`
- `sidebar.tsx`
- `staff-client-provider.tsx`

### Support (`src/components/support/`)

**Count:** 4 files

- `create-support-ticket-form.tsx`
- `support-assign-button.tsx`
- `support-reply-form.tsx`
- `support-status-buttons.tsx`

### Tutorials (`src/components/tutorials/`)

**Count:** 2 files

- `contextual-help-banner.tsx`
- `tutorial-progress-widget.tsx`

### Announcements (`src/components/announcements/`)

**Count:** 1 file

- `WhatsNewModal.tsx`

## Critical Issues

### 1. Duplicate Primitives

Three components exist in both locations with different implementations:

| Component | Main Version                                         | Primitives Version                                          | Import Count |
| --------- | ---------------------------------------------------- | ----------------------------------------------------------- | ------------ |
| Button    | `ui/button.tsx` (1,995 bytes)<br/>Uses design tokens | `ui/primitives/button.tsx` (1,872 bytes)<br/>Uses gradients | 146 vs 11    |
| Badge     | `ui/badge.tsx` (2,058 bytes)                         | `ui/primitives/badge.tsx` (1,389 bytes)                     | Not counted  |
| Card      | `ui/card.tsx` (1,848 bytes)                          | `ui/primitives/card.tsx` (2,607 bytes)                      | Not counted  |

**Analysis:**

- **Button:** `ui/button.tsx` is the canonical version (design token based, widely used)
- **Badge/Card:** Need to compare implementations and usage
- **Primitives versions:** Appear to be older gradient-based designs

**Recommendation:** Remove `ui/primitives/` directory entirely, update the 11 imports to use canonical versions.

### 2. Domain Components in UI Layer

| Component                | Current Location | Recommended Location        | Reason                                   |
| ------------------------ | ---------------- | --------------------------- | ---------------------------------------- |
| `oib-input.tsx`          | `ui/`            | `forms/` or `onboarding/`   | OIB is Croatian tax ID - domain specific |
| `glossary-term.tsx`      | `ui/`            | `content/`                  | Content-specific functionality           |
| `competence-tooltip.tsx` | `ui/`            | `guidance/`                 | Part of guidance system                  |
| `stat-card.tsx`          | `ui/`            | `dashboard/` or `patterns/` | Dashboard-specific pattern               |
| `next-steps.tsx`         | `ui/`            | `guidance/` or `patterns/`  | Guidance pattern                         |

### 3. Split Directories

| Domain   | Directories                 | Recommendation                                                  |
| -------- | --------------------------- | --------------------------------------------------------------- |
| Expenses | `expense/`, `expenses/`     | Consolidate to `expenses/`                                      |
| Invoices | `invoice/`, `invoices/`     | Keep separate: `invoice/` for creation, `invoices/` for listing |
| Motion   | `motion/`, `ui/motion/`     | Consolidate to `motion/`                                        |
| Patterns | `patterns/`, `ui/patterns/` | Consolidate to `patterns/`                                      |

### 4. Duplicate Components Across Domains

| Component        | Locations                     | Recommendation                                                   |
| ---------------- | ----------------------------- | ---------------------------------------------------------------- |
| AuroraBackground | `auth/`, `marketing/`         | Keep separate (different use cases) or extract to `ui/patterns/` |
| EmptyState       | `ui/`, `assistant-v2/`        | Review if they serve same purpose                                |
| RefusalCard      | `assistant/`, `assistant-v2/` | Part of v1/v2 migration - acceptable                             |

## Consolidation Plan

### Phase 1: Remove Duplicate Primitives (High Priority)

**Impact:** Low risk, 11 imports to update

1. **Audit imports:**

   ```bash
   grep -r "from.*ui/primitives/button" src/
   grep -r "from.*ui/primitives/badge" src/
   grep -r "from.*ui/primitives/card" src/
   ```

2. **Update imports:**
   - Replace `@/components/ui/primitives/button` → `@/components/ui/button`
   - Replace `@/components/ui/primitives/badge` → `@/components/ui/badge`
   - Replace `@/components/ui/primitives/card` → `@/components/ui/card`

3. **Verify no functionality is lost:**
   - Compare implementations
   - Run tests
   - Check visual regression if available

4. **Delete directory:**

   ```bash
   rm -rf src/components/ui/primitives/
   ```

5. **Update documentation:**
   - Remove references to primitives directory
   - Update component import examples

**Files to delete:**

- `src/components/ui/primitives/badge.tsx`
- `src/components/ui/primitives/button.tsx`
- `src/components/ui/primitives/card.tsx`
- `src/components/ui/primitives/index.ts`
- `src/components/ui/primitives/badge-examples.md`

**Success Criteria:**

- ✅ All imports updated
- ✅ Tests pass
- ✅ No visual regressions
- ✅ Directory deleted

### Phase 2: Move Misplaced Domain Components (Medium Priority)

**Impact:** Medium risk, need to update many imports

#### 2.1: Move OIB Input to Forms

```bash
# Move file
mv src/components/ui/oib-input.tsx src/components/forms/

# Update imports
# @/components/ui/oib-input → @/components/forms/oib-input
```

**Affected files:** Search results needed

#### 2.2: Move Content Components

```bash
# Move glossary term
mv src/components/ui/glossary-term.tsx src/components/content/

# Update imports
# @/components/ui/glossary-term → @/components/content/glossary-term
```

#### 2.3: Move Guidance Components

```bash
# Move to guidance
mv src/components/ui/competence-tooltip.tsx src/components/guidance/
mv src/components/ui/next-steps.tsx src/components/guidance/

# Update imports
```

#### 2.4: Move Stat Card

Decision needed: `dashboard/` or `patterns/`?

**If patterns:**

- More reusable
- Can be used in multiple contexts
- Better separation of concerns

**If dashboard:**

- Only used in dashboard context
- Clearer domain association

**Recommendation:** Move to `patterns/` for reusability.

**Success Criteria:**

- ✅ All imports updated
- ✅ Tests pass
- ✅ Files in correct locations
- ✅ No orphaned imports

### Phase 3: Consolidate Split Directories (Medium Priority)

#### 3.1: Consolidate Expenses

```bash
# Merge expense/ into expenses/
mv src/components/expense/receipt-scanner.tsx src/components/expenses/
mv src/components/expense/receipt-scanner-with-feedback.tsx src/components/expenses/
rmdir src/components/expense/

# Update imports
# @/components/expense/* → @/components/expenses/*
```

#### 3.2: Consolidate Motion

```bash
# Move ui/motion/ to motion/
mv src/components/ui/motion/FadeIn.tsx src/components/motion/
mv src/components/ui/motion/HoverScale.tsx src/components/motion/
mv src/components/ui/motion/GlowOrb.tsx src/components/motion/
rmdir src/components/ui/motion/

# Update imports
# @/components/ui/motion/* → @/components/motion/*
```

#### 3.3: Consolidate Patterns

```bash
# Move ui/patterns/ to patterns/
mv src/components/ui/patterns/GlassCard.tsx src/components/patterns/
mv src/components/ui/patterns/GradientButton.tsx src/components/patterns/
mv src/components/ui/patterns/SectionBackground.tsx src/components/patterns/
rmdir src/components/ui/patterns/

# Update imports and index.ts
# @/components/ui/patterns/* → @/components/patterns/*
```

**Success Criteria:**

- ✅ All related components in single directory
- ✅ All imports updated
- ✅ Tests pass
- ✅ Documentation updated

### Phase 4: Review Duplicate Components (Low Priority)

**Components to review:**

1. **AuroraBackground** (`auth/` vs `marketing/`)
   - Compare implementations
   - If identical, extract to `ui/patterns/` or `patterns/`
   - If different, document differences and keep separate

2. **EmptyState** (`ui/` vs `assistant-v2/`)
   - Check if they serve same purpose
   - Consolidate if possible

3. **Dashboard Cards**
   - Multiple `*-card.tsx` components in `dashboard/`
   - Look for common patterns
   - Consider extracting shared card pattern to `patterns/`

**Success Criteria:**

- ✅ All duplicates documented
- ✅ Decision made for each (consolidate or keep)
- ✅ Common patterns extracted if applicable

### Phase 5: Document Component Layer Guidelines (Low Priority)

Create clear documentation for:

1. **When to use each layer:**
   - `ui/` - Pure primitives with no domain logic
   - `motion/` - Animation behaviors
   - `patterns/` - Composed UI patterns
   - `sections/` - Page section compositions
   - `templates/` - Full page templates
   - Domain directories - Domain-specific functionality

2. **Import rules:**
   - Each layer can only import from layers to its left
   - Domain components can import from any layer
   - No circular dependencies

3. **Naming conventions:**
   - Primitives: lowercase-with-dashes
   - Components: PascalCase
   - Domain-specific: descriptive names with domain context

4. **When to create new directories:**
   - 3+ related components = new directory
   - Clear domain boundary
   - Shared domain logic

**Deliverable:** `docs/03_ARCHITECTURE/COMPONENT_GUIDELINES.md`

## Implementation Priority

| Priority  | Phase                                | Impact | Risk   | Effort    |
| --------- | ------------------------------------ | ------ | ------ | --------- |
| 🔴 High   | Phase 1: Remove Duplicate Primitives | High   | Low    | 2-3 hours |
| 🟡 Medium | Phase 2: Move Domain Components      | Medium | Medium | 4-6 hours |
| 🟡 Medium | Phase 3: Consolidate Directories     | Medium | Low    | 3-4 hours |
| 🟢 Low    | Phase 4: Review Duplicates           | Low    | Low    | 4-6 hours |
| 🟢 Low    | Phase 5: Documentation               | Low    | None   | 2-3 hours |

**Total Estimated Effort:** 15-22 hours

## Success Metrics

1. **Reduced Duplication:**
   - ✅ Zero duplicate primitive components
   - ✅ All domain components in correct directories
   - ✅ Single source of truth for each component

2. **Improved Organization:**
   - ✅ Clear layer boundaries
   - ✅ No misplaced components
   - ✅ Logical directory structure

3. **Better Maintainability:**
   - ✅ Documented component guidelines
   - ✅ Consistent naming conventions
   - ✅ Clear import patterns

4. **Developer Experience:**
   - ✅ Easy to find components
   - ✅ Clear where new components should go
   - ✅ Reduced cognitive load

## Testing Strategy

1. **Unit Tests:**
   - Run full test suite after each phase
   - No test failures introduced

2. **Visual Regression:**
   - Screenshot comparison if available
   - Manual verification of key pages

3. **Build Verification:**
   - Successful TypeScript compilation
   - No missing imports
   - No circular dependencies

4. **Runtime Verification:**
   - Test all affected pages
   - Verify no console errors
   - Check component functionality

## Rollback Plan

For each phase:

1. **Create feature branch** with descriptive name
2. **Commit each change separately** with clear messages
3. **Test thoroughly** before pushing
4. **Create PR** for review
5. **If issues found:** Revert specific commits or entire branch

## Migration Scripts

### Script 1: Find and Replace Imports

```bash
#!/bin/bash
# find-replace-imports.sh

OLD_PATH="$1"
NEW_PATH="$2"

echo "Replacing imports from $OLD_PATH to $NEW_PATH"

# Find all TypeScript/TSX files
find src -type f \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/.next/*" \
  -exec sed -i "s|from ['\"]$OLD_PATH['\"]|from \"$NEW_PATH\"|g" {} \;

# Also handle import with alias
find src -type f \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/.next/*" \
  -exec sed -i "s|from ['\"]@/components/$OLD_PATH['\"]|from \"@/components/$NEW_PATH\"|g" {} \;

echo "Import replacement complete"
```

### Script 2: Verify No Broken Imports

```bash
#!/bin/bash
# verify-imports.sh

echo "Checking for broken imports..."

# Try to build
npm run build

if [ $? -eq 0 ]; then
  echo "✅ Build successful - no broken imports"
else
  echo "❌ Build failed - check for import errors"
  exit 1
fi
```

### Script 3: Find Import Usage

```bash
#!/bin/bash
# find-import-usage.sh

COMPONENT_PATH="$1"

echo "Finding imports of $COMPONENT_PATH"

grep -r "from.*$COMPONENT_PATH" src/ \
  --include="*.ts" \
  --include="*.tsx" \
  --exclude-dir=node_modules \
  --exclude-dir=.next

echo "Search complete"
```

## Component Statistics

- **Total Component Files:** 305
- **Total Component Directories:** 63
- **Duplicate Components:** 3 (button, badge, card)
- **Misplaced Components:** 5 (oib-input, glossary-term, competence-tooltip, stat-card, next-steps)
- **Split Directories:** 3 (expense/expenses, motion, patterns)
- **Largest Directory:** `assistant-v2/` (30 files)
- **Domain Directories:** 38
- **Layer Directories:** 5 (ui, motion, patterns, sections, templates)

## Appendix A: Complete File Listing

See section "Complete Component Inventory" above for detailed breakdown.

## Appendix B: Import Analysis

### Most Imported Components

```bash
# Top 10 most imported components (sample - full analysis needed)
1. Button (ui/button.tsx) - 146 imports
2. Card (ui/card.tsx) - ~100+ imports (estimated)
3. Badge (ui/badge.tsx) - ~80+ imports (estimated)
4. Input (ui/input.tsx) - ~70+ imports (estimated)
5. Select (ui/select.tsx) - ~60+ imports (estimated)
```

### Rarely Used Components

Components with <5 imports should be reviewed for:

- Are they still needed?
- Should they be documented better?
- Are they in the right location?

## Appendix C: Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                         Pages                           │
│                     (Next.js routes)                    │
└────────────────────┬────────────────────────────────────┘
                     │ imports
┌────────────────────▼────────────────────────────────────┐
│                      Templates                          │
│              (Portal-scoped layouts)                    │
└────────────────────┬────────────────────────────────────┘
                     │ imports
┌────────────────────▼────────────────────────────────────┐
│                      Sections                           │
│               (HeroSection, FeatureGrid)                │
└────────────────────┬────────────────────────────────────┘
                     │ imports
┌────────────────────▼────────────────────────────────────┐
│                      Patterns                           │
│            (FeatureCard, SectionHeading)                │
└────────────────────┬────────────────────────────────────┘
                     │ imports
┌────────────────────▼────────────────────────────────────┐
│         UI Primitives        │        Motion            │
│  (Button, Card, Input, etc)  │  (Reveal, Stagger, etc)  │
└──────────────────────────────┴──────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  Domain Components                      │
│  (dashboard/, auth/, invoice/, etc)                     │
│                                                          │
│  Can import from: ui/, motion/, patterns/, sections/    │
│  Cannot import from: other domain components            │
└─────────────────────────────────────────────────────────┘
```

## Appendix D: Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Component architecture overview
- [COMPONENT_LAYERS_MIGRATION.md](../03_ARCHITECTURE/COMPONENT_LAYERS_MIGRATION.md) - Migration guide (if exists)
- [UI Design System](../../docs/product-bible/05-UI-EXPERIENCE.md) - Product Bible UI chapter

## Next Steps

1. **Review this document** with team
2. **Prioritize phases** based on business needs
3. **Assign ownership** for each phase
4. **Create tracking issues** for each phase
5. **Schedule implementation** in sprints
6. **Monitor progress** and adjust plan as needed

## Version History

| Version | Date       | Author       | Changes                                  |
| ------- | ---------- | ------------ | ---------------------------------------- |
| 1.0     | 2025-12-29 | System Audit | Initial inventory and consolidation plan |

---

**Document Status:** ✅ Complete - Ready for Review
**Reviewed By:** Pending
**Approved By:** Pending
**Implementation Status:** Not Started
