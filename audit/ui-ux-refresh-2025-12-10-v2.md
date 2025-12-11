# UI/UX Modernization – Iteration 2 (2025-12-10)

The new shell/components (Header, Sidebar, MobileNav, FAB, redesigned Contacts page) already move FiskAI toward a premium SaaS feel. Below are the next-level refinements to reach a cohesive, polished experience across desktop and mobile.

---
## Completed in Iteration 2
- Global command palette (desktop + mobile trigger) for fast navigation.
- Mobile shell upgrades: bottom navigation bar, floating FAB trigger for quick actions/search.
- Contacts page quick filters + command palette hook for segmentation.
- E-invoice composer upgrades: autosave indicator, sticky mobile controls, PDF preview/download component.
- Header notification center wired to live e-invoice/audit data (`src/lib/notifications.ts`), auto-refreshes every 60 s, and shows unread badges + mark-as-read state per company user.
- Products table now uses searchable + multi-select filters to slice by VAT category/status with inline stats.
- Settings hub reorganized into tabbed navigation with compliance status cards and quick links to premises/audit log.
- Header now surfaces an onboarding progress pill with CTA + accountant invite link, so admins see remaining setup steps globally.
- Invoices list received multi-select filters (type/status) plus invoice/buyer search with preserved pagination URLs.
- Expenses list now mirrors the modern filters (search + multi-select categories/status) for consistent workflow UX.
- Expenses table now renders via `ResponsiveTable`, giving mobile users card-style entries with status chips and detail links.
- Invoices table also uses `ResponsiveTable` for cohesive desktop/mobile behavior.
- Banking transactions table adopts `ResponsiveTable`, so mobile users see transaction cards with match status chips and quick link buttons.
- Base design tokens (`src/styles/tokens.ts`) now drive Tailwind, glassmorphic surfaces, and typography utilities; hero banner showcases the layered gradient treatment.
- Sidebar and header dropdowns gained glassmorphic cards + motion, and the bottom navigation now bundles a slide-up quick actions drawer for mobile.
- Dashboard hero area now features a “Današnje akcije” card merging alerts, quick stats, and onboarding tasks, with fiscalization/recents stacked in the right column for a story-driven view.
- Contact cards gained inline quick actions (email/call/new invoice) to reduce friction when following up.
- Contact filters now include segment chips (PDV obveznici, bez e-maila, bez e-računa) to target workflow personas quickly.
- Dashboard hero/insights: gradient hero banner, revenue trend sparkline, invite/AI action cards, reorganized onboarding grid.
- Dashboard insight column now includes PDV overview (plaćeno/u tijeku), invoice funnel visualization, and contextual tips so admins see tax exposure and conversion health at a glance.
- Products page now surfaces a “Zdravlje kataloga” card that highlights missing šifre, nula cijena, and neaktivni artikli with quick CTA to add items (CSV import button stubbed for upcoming bulk imports).
- Expenses list gained quick status chips + aggregate cards (paid/pending/draft counts and sums) so finance teams can jump straight to actionable buckets.

## Upcoming Enhancements
### 1. Visual Language & Theming
- **Global tokens:** Introduce a design tokens file (e.g., `styles/tokens.ts`) feeding Tailwind CSS variables for spacing, typography, color (brand/neutral surfaces, gradients). Enforce consistent radii and shadows via utility classes.
- **Surface layering:** Use subtle glassmorphism—semi-transparent panels with blur—for key cards (dashboard stats, onboarding checklist) to add depth. Apply ambient gradients or duotone backgrounds on hero sections.
- **Typography & iconography:** Standardize on a modern typeface (e.g., Inter, Sora) with weights/styles defined in CSS. Ensure Lucide icons follow a consistent size/color scheme; add animated icons for status states (e.g., fiscalization success).

## 2. Navigation & Shell
- **Header enhancements:**
  - Add global search input (command palette) to jump between contacts/invoices.
  - Show onboarding progress pill next to company switcher; include “Invite accountant” link.
  - Animate dropdowns (UserMenu, QuickActions) with micro-interactions (spring transitions, hover highlights).
- **Sidebar refinements:**
  - Display user/company avatars at the top (collapsible). Incorporate contextual badges (e.g., “2 pending approvals”).
  - Allow customizing nav order, grouping modules under “Finance”, “Operations”, “Master Data”.
  - Add keyboard shortcut hints (e.g., `⌘1`, `⌘2`) in tooltips.
- **Mobile nav:**
  - Expand `MobileNav` + `FAB` combo into a bottom navigation bar with icons, plus a slide-in quick actions drawer. Ensure safe-area padding for iOS.

## 3. Dashboard Experience
- **Hero section:** Combine AlertBanner, OnboardingChecklist, QuickStats into a grid that tells a story: left column for “Today’s actions”, right column for fiscalization status + recent activity.
- **Visualization:** Add small charts (revenue trend, outstanding VAT, invoice funnel). Use the `stat-card` component with spark lines and dynamic coloring.
- **Personalization:** Display tips/insights per company type (paušalni vs d.o.o.). Include AI assistant entry point for natural-language queries.

## 4. Workflow-Specific Enhancements
- **Contacts:**
  - Introduce inline quick actions on cards (email, call, create invoice). Use avatars/logos and tags (VIP, overdue). Provide list/crm-board view toggle.
  - Add filter chips (e.g., “Only VAT payers”, “Needs onboarding”) and saved filter presets.
  - For mobile, use swipe gestures on cards (left: edit, right: more…).
- **E-Invoice composer:**
  - Replace simple form with stepper: 1) Buyer & metadata, 2) Lines & products, 3) Preview/send. Keep summary sidebar sticky with totals, due date, attachments.
  - Provide autosave and multi-user commenting (activity sidebar). Add dark/light theme preview and PDF skeleton.
- **Products/Expenses:**
  - Use responsive table component with inline editing, bulk selection, multi-sort. Add “Import CSV” dropzone.
  - Provide contextual banners (e.g., “5 products missing VAT category”).
- **Settings:**
  - Organize into tabs (Company profile, Banking, Integrations). Use checklists and inline validation (e.g., domain verification, API key status).

## 5. Feedback & Motion
- **Global toast/notification center:** Already seeded with `Notifications` component—extend to include activity log, alerts, and link to detail pages.
- **Micro-interactions:** Add subtle scale/opacity transitions on cards, button press animations, and skeleton loaders (already used in Contacts) for every async fetch.
- **Success/error flows:** After creating resources (contact, invoice), show contextual suggestions (e.g., “Send invoice now”, “Add customer to email list”). Use celebratory confetti or checkmark animations for major milestones (first invoice, fiscalization success).

## 6. Mobile-First Enhancements
- **Sticky action bar:** For long forms (invoice, onboarding), replicate a bottom bar with “Prev/Next” and progress indicator (mirroring the desktop stepper).
- **Gesture support:** Pull-to-refresh on lists, swipe between tabs (Contacts <-> Products), haptic feedback for actions.
- **Offline-ready cues:** Indicate sync status in header when offline; allow drafting invoices/expenses offline with queued sync.

## 7. Accessibility & Localization
- Continue ARIA improvements: ensure new components (QuickActions, FAB, modals) are keyboard-accessible with focus traps.
- Provide dark/light toggle in header; respect `prefers-color-scheme` and maintain contrast ratio >= 4.5:1.
- Expand translation support—current Croatian strings should be externalized for future EN/DE rollouts.

## 8. Implementation Approach
1. **Design system iteration:** finalize tokens, components (cards, tables, forms, nav) in Figma, reflecting new gradients/animations.
2. **Shell polish:** integrate command palette, search, nav badges, better mobile nav.
3. **Page-by-page refinement:** start with Dashboard → Contacts → E-Invoices; apply new components + motion/feedback.
4. **Mobile QA:** test breakpoints, gestures, safe areas.
5. **Accessibility checks:** run manual + automated (axe) tests after changes.

This plan should guide the next UI/UX pass to elevate the modern feel beyond the current redesign while keeping the app frictionless across devices. EOF
