# Component Library Inventory

> **Last Updated:** 2025-12-28
> **Total Components:** 308 files
> **Tech Stack:** React, Tailwind CSS, CVA (Class Variance Authority)

---

## Overview

FiskAI uses a layered component architecture:

1. **UI Primitives** - Core design system atoms (button, input, card)
2. **UI Patterns** - Reusable composed patterns (GlassCard, modals)
3. **Feature Components** - Domain-specific components (invoice forms, dashboard cards)
4. **Layout Components** - Page structure (sidebar, header, portals)

---

## Directory Structure

```
src/components/
├── ui/                    # 37 files - Core design system
│   ├── primitives/        # Base atoms (button, badge, card)
│   ├── patterns/          # Composed patterns (GlassCard, GradientButton)
│   ├── motion/            # Animation components (FadeIn, HoverScale)
│   └── command-palette/   # Command palette system
├── layout/                # 13 files - Page structure
├── dashboard/             # 15 files - Dashboard cards & widgets
├── assistant-v2/          # 24 files - AI Assistant UI
├── marketing/             # 23 files - Marketing site components
├── admin/                 # 8 files - Admin portal
├── staff/                 # 5 files - Staff portal
├── pausalni/              # 8 files - Tax management
├── guidance/              # 7 files - Guidance system
├── invoice/               # 5 files - Invoice management
├── documents/             # 5 files - Document management
├── auth/                  # 6 files - Authentication flows
├── onboarding/            # 6 files - Onboarding wizard
├── contacts/              # 3 files - Contact management
├── products/              # 3 files - Product catalog
├── expenses/              # 2 files - Expense tracking
├── reports/               # 1 file - Report generation
├── support/               # 4 files - Support ticket system
├── news/                  # 11 files - News/blog system
├── content/               # 7 files - Content rendering
├── knowledge-hub/         # Calculators, wizards, guides
└── providers/             # Context providers
```

---

## Core UI Components

### Primitives (`src/components/ui/primitives/`)

| Component | File | Purpose | Variants |
|-----------|------|---------|----------|
| Button | `button.tsx` | Primary action button | default, outline, ghost, destructive |
| Badge | `badge.tsx` | Status/category labels | default, secondary, destructive, outline |
| Card | `card.tsx` | Container with header/content/footer | - |

### Base UI (`src/components/ui/`)

| Component | File | Purpose |
|-----------|------|---------|
| Alert | `alert.tsx` | Inline notifications |
| Badge | `badge.tsx` | Status indicators |
| Button | `button.tsx` | Actions with CVA variants |
| Card | `card.tsx` | Content containers |
| Combobox | `combobox.tsx` | Searchable select |
| ConfirmDialog | `confirm-dialog.tsx` | Confirmation modals |
| DataTable | `data-table.tsx` | Tabular data display |
| DropdownMenu | `dropdown-menu.tsx` | Context menus |
| EmptyState | `empty-state.tsx` | No-data placeholders |
| FAB | `fab.tsx` | Floating action button |
| GlossaryTerm | `glossary-term.tsx` | Tooltip-enabled terms |
| Input | `input.tsx` | Text input fields |
| KeyboardShortcut | `keyboard-shortcut.tsx` | Shortcut hints |
| Label | `label.tsx` | Form labels |
| LoadingSpinner | `loading-spinner.tsx` | Loading indicators |
| Logo | `Logo.tsx` | Brand logo |
| MobileCard | `mobile-card.tsx` | Mobile-optimized cards |
| Modal | `modal.tsx` | Dialog windows |
| MultiSelect | `multi-select.tsx` | Multiple selection |
| NextSteps | `next-steps.tsx` | Action suggestions |
| NotificationCenter | `notification-center.tsx` | Notification dropdown |
| OIBInput | `oib-input.tsx` | Croatian ID validation input |
| PageCard | `page-card.tsx` | Full-page cards |
| ProgressBar | `progress-bar.tsx` | Progress indicators |
| ResponsiveTable | `responsive-table.tsx` | Mobile-friendly tables |
| Select | `select.tsx` | Dropdown selection |
| Skeleton | `skeleton.tsx` | Loading placeholders |
| SmartLink | `smart-link.tsx` | Intelligent navigation |
| StatCard | `stat-card.tsx` | Metric display |
| Switch | `switch.tsx` | Toggle switches |
| Table | `table.tsx` | Data tables |
| Textarea | `textarea.tsx` | Multi-line input |
| Tooltip | `tooltip.tsx` | Hover information |
| CompetenceTooltip | `competence-tooltip.tsx` | User competence hints |

### Motion Components (`src/components/ui/motion/`)

| Component | File | Purpose |
|-----------|------|---------|
| FadeIn | `FadeIn.tsx` | Fade-in animation wrapper |
| GlowOrb | `GlowOrb.tsx` | Animated glow effect |
| HoverScale | `HoverScale.tsx` | Scale on hover |

### Visual Patterns (`src/components/ui/patterns/`)

| Component | File | Purpose |
|-----------|------|---------|
| GlassCard | `GlassCard.tsx` | Glassmorphism card |
| GradientButton | `GradientButton.tsx` | Gradient-styled button |
| SectionBackground | `SectionBackground.tsx` | Section backgrounds |

---

## Layout Components

### Portal Layouts (`src/components/layout/`)

| Component | File | Portal | Purpose |
|-----------|------|--------|---------|
| AppSidebar | `app-sidebar.tsx` | Client | Main navigation sidebar |
| AppHeader | `app-header.tsx` | Client | Top header bar |
| MobileSidebar | `mobile-sidebar.tsx` | Client | Mobile navigation |
| UserNav | `user-nav.tsx` | All | User menu dropdown |
| ThemeToggle | `theme-toggle.tsx` | All | Dark/light mode switch |
| Breadcrumbs | `breadcrumbs.tsx` | All | Navigation breadcrumbs |
| HelpButton | `help-button.tsx` | Client | Contextual help trigger |
| FloatingActionBar | `floating-action-bar.tsx` | Client | Mobile quick actions |

### Admin Layout (`src/components/admin/`)

| Component | File | Purpose |
|-----------|------|---------|
| AdminSidebar | `admin-sidebar.tsx` | Admin navigation |
| AdminHeader | `header.tsx` | Admin header |
| Dashboard | `dashboard.tsx` | Admin overview |
| StaffManagement | `staff-management.tsx` | Staff CRUD |
| TenantsList | `tenants-list.tsx` | Company management |
| AlertsPanel | `alerts-panel.tsx` | System alerts |

### Staff Layout (`src/components/staff/`)

| Component | File | Purpose |
|-----------|------|---------|
| StaffSidebar | `sidebar.tsx` | Staff navigation |
| StaffHeader | `header.tsx` | Staff header |
| Dashboard | `dashboard.tsx` | Staff overview |
| ClientsList | `clients-list.tsx` | Assigned clients |
| StaffClientProvider | `staff-client-provider.tsx` | Client context |

---

## Feature Components

### Dashboard (`src/components/dashboard/`)

| Component | File | Purpose |
|-----------|------|---------|
| ComplianceStatusCard | `compliance-status-card.tsx` | Compliance overview |
| FiscalizationStatus | `fiscalization-status.tsx` | Fiscalization state |
| OnboardingChecklist | `onboarding-checklist.tsx` | Setup progress |
| DeadlineCountdownCard | `deadline-countdown-card.tsx` | Upcoming deadlines |
| AlertBanner | `alert-banner.tsx` | Important notices |
| VATOverviewCard | `vat-overview-card.tsx` | VAT summary |
| ActionCards | `action-cards.tsx` | Quick actions |
| InsightsCard | `insights-card.tsx` | AI insights |
| TodayActionsCard | `today-actions-card.tsx` | Daily tasks |
| RecentActivity | `recent-activity.tsx` | Activity feed |
| RevenueTrendCard | `revenue-trend-card.tsx` | Revenue chart |
| InvoiceFunnelCard | `invoice-funnel-card.tsx` | Invoice pipeline |
| HeroBanner | `hero-banner.tsx` | Welcome section |
| QuickStats | `quick-stats.tsx` | KPI metrics |
| PausalniStatusCard | `pausalni-status-card.tsx` | Tax status |

### AI Assistant (`src/components/assistant-v2/`)

| Component | File | Purpose |
|-----------|------|---------|
| AssistantContainer | `AssistantContainer.tsx` | Main container |
| AssistantInput | `AssistantInput.tsx` | Query input |
| AnswerCard | `AnswerCard.tsx` | Response display |
| AnswerSection | `AnswerSection.tsx` | Answer content |
| AnswerSkeleton | `AnswerSkeleton.tsx` | Loading state |
| AuthorityBadge | `AuthorityBadge.tsx` | Source authority |
| ConfidenceBadge | `ConfidenceBadge.tsx` | Confidence level |
| ConflictBanner | `ConflictBanner.tsx` | Rule conflicts |
| CTABlock | `CTABlock.tsx` | Call-to-action |
| DataPointList | `DataPointList.tsx` | Extracted data |
| ErrorCard | `ErrorCard.tsx` | Error display |
| EvidencePanel | `EvidencePanel.tsx` | Source evidence |
| HistoryBar | `HistoryBar.tsx` | Query history |
| PersonalizationPanel | `PersonalizationPanel.tsx` | User context |
| RefusalCard | `RefusalCard.tsx` | Scope refusals |
| RelatedQuestions | `RelatedQuestions.tsx` | Follow-up suggestions |
| SourceCard | `SourceCard.tsx` | Citation display |
| SuggestionChips | `SuggestionChips.tsx` | Query suggestions |
| SupportingSources | `SupportingSources.tsx` | Evidence list |
| WhyDrawer | `WhyDrawer.tsx` | Reasoning explanation |
| Announcer | `Announcer.tsx` | A11y announcements |
| ClientDataPanel | `ClientDataPanel.tsx` | Business context |

### Reasoning UI (`src/components/assistant-v2/reasoning/`)

| Component | File | Purpose |
|-----------|------|---------|
| ReasoningAssistantContainer | `ReasoningAssistantContainer.tsx` | Reasoning mode |
| ReasoningCard | `ReasoningCard.tsx` | Stage display |
| ReasoningStepper | `ReasoningStepper.tsx` | Stage progress |
| StageStep | `StageStep.tsx` | Individual stage |
| TerminalAnswerCard | `TerminalAnswerCard.tsx` | Final answer |
| MorphingPill | `MorphingPill.tsx` | Animated badge |

### Guidance System (`src/components/guidance/`)

| Component | File | Purpose |
|-----------|------|---------|
| GuidanceChecklist | `guidance-checklist.tsx` | Task checklist |
| GuidanceCard | `guidance-card.tsx` | Help card |
| HelpDensityToggle | `help-density-toggle.tsx` | Detail level |
| PatternInsight | `pattern-insight.tsx` | AI suggestions |
| CompetenceBadge | `competence-badge.tsx` | Skill level |
| PreferencePanel | `preference-panel.tsx` | User preferences |
| ContextualHelp | `contextual-help.tsx` | Inline help |

### Pausalni Tax (`src/components/pausalni/`)

| Component | File | Purpose |
|-----------|------|---------|
| PausalniDashboard | `pausalni-dashboard.tsx` | Tax overview |
| POSDWizard | `posd-wizard.tsx` | Form generation |
| ObligationTimeline | `obligation-timeline.tsx` | Deadline tracking |
| PaymentSlipModal | `payment-slip-modal.tsx` | Payment slip |
| BatchPaymentSlips | `batch-payment-slips.tsx` | Bulk payments |
| EUTransactionReview | `eu-transaction-review.tsx` | EU transactions |
| FormGeneratorDialog | `form-generator-dialog.tsx` | Form wizard |
| NotificationPreferences | `notification-preferences.tsx` | Alert settings |

---

## Authentication Components

### Auth Flows (`src/components/auth/`)

| Component | File | Purpose |
|-----------|------|---------|
| LoginForm | `login-form.tsx` | Email login |
| PasskeyLogin | `passkey-login.tsx` | WebAuthn login |
| MagicLinkForm | `magic-link-form.tsx` | Passwordless email |
| OAuthButtons | `oauth-buttons.tsx` | Social login |
| RegistrationWizard | `registration-wizard.tsx` | New user flow |
| PasswordReset | `password-reset.tsx` | Password recovery |

### Onboarding (`src/components/onboarding/`)

| Component | File | Purpose |
|-----------|------|---------|
| StepBasicInfo | `step-basic-info.tsx` | Company basics |
| StepAddress | `step-address.tsx` | Business address |
| StepContactTax | `step-contact-tax.tsx` | Tax registration |
| StepCompetence | `step-competence.tsx` | Skill level |
| StepPausalniProfile | `step-pausalni-profile.tsx` | Tax profile |
| StepIndicator | `step-indicator.tsx` | Progress dots |

---

## Import/Export Components

### Data Import (`src/components/import/`)

| Component | File | Purpose |
|-----------|------|---------|
| ImportWizard | `import-wizard.tsx` | File import flow |
| ColumnMapper | `column-mapper.tsx` | Field mapping |
| PreviewTable | `preview-table.tsx` | Data preview |
| ValidationResults | `validation-results.tsx` | Error display |
| ImportProgress | `import-progress.tsx` | Upload status |
| BankStatementImport | `bank-statement-import.tsx` | Bank files |
| CSVImport | `csv-import.tsx` | CSV handling |
| ImportHistory | `import-history.tsx` | Past imports |

---

## Visibility System Integration

Components integrate with the visibility system via:

| Pattern | Usage |
|---------|-------|
| `RequiresModule` | Hides components when module not entitled |
| `RequiresPlan` | Hides components below plan tier |
| `RequiresRole` | Hides based on user role |
| `useCompetence()` | Adapts detail level to user skill |

Example:
```tsx
<RequiresModule module="banking">
  <BankSyncCard />
</RequiresModule>
```

---

## Testing Coverage

Components with test files (`__tests__/`):

- `src/components/assistant-v2/__tests__/` - 20 test files
- `src/components/content/__tests__/` - Content rendering tests

---

## Design Tokens

Components use Tailwind CSS with custom design tokens:

| Token Category | Example |
|----------------|---------|
| Colors | `bg-primary`, `text-muted-foreground` |
| Spacing | `gap-4`, `p-6` |
| Typography | `text-sm`, `font-semibold` |
| Borders | `rounded-lg`, `border-border` |
| Shadows | `shadow-sm`, `shadow-lg` |

CVA (Class Variance Authority) is used for component variants:

```tsx
const buttonVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", outline: "..." },
    size: { sm: "...", md: "...", lg: "..." }
  }
})
```

---

## Changelog

| Date | Change |
|------|--------|
| 2025-12-28 | Initial inventory from codebase audit |
