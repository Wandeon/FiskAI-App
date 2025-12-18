# Responsive UX System for FiskAI

## Information Tiers + Capability Tiers (and how to enforce it)

**Audience:** Everyone shipping UI (marketing + app)  
**Goal:** One maintainable UI system that feels intentional on mobile and powerful on desktop — without duplicating logic or building “two apps”.

---

## 0) The problem we’re actually solving

When “responsive design” is treated as “desktop layout shrunk down”, you end up with:

- Overloaded mobile screens (too many buttons, too much data, too many choices)
- Desktop screens that feel like “mobile stretched”, missing power workflows
- Duplicate components (`DesktopX`, `MobileX`) that drift apart and break differently
- Endless debates: “Should this be visible on mobile?” (because there’s no shared rule)

The fix is not more breakpoints.
The fix is **a shared information hierarchy + capability tier system** that every page follows.

---

## 1) The core mental model (the sanity saver)

You don’t maintain two versions.
You maintain **one system** with **different constraints**.

Mobile is not “smaller desktop”.
Desktop is not “expanded mobile”.

They answer different questions at different moments:

- **Mobile users act** (one task, one hand, one screen).
- **Desktop users scan + configure** (multiple tasks, bulk actions, dense data).

So the system must separate:

1. **Information tiers** (what matters)
2. **Capability tiers** (what the device supports comfortably)

---

## 2) Definitions: Information tiers (per page)

For every page/feature, classify UI into tiers.

### Tier 1 — Must have (mobile first)

If Tier 1 fails, the page fails on mobile.

- Primary action (1)
- Primary data (the thing the page is about)
- Current context (where am I, what am I looking at)

### Tier 2 — Helpful

- Secondary actions
- Supporting information
- Short explanations
- Lightweight filtering/sorting

### Tier 3 — Nice to have (desktop-only by default)

- Bulk actions
- Dense tables / many columns
- Power-user controls
- Side panels, advanced filters, analytics
- Inline editing at scale

**Rule:** Tier 3 should not appear on mobile by default. No guilt.
If it matters, it must be **accessible** (via a sheet/drawer or “Open on desktop”), but not always visible.

---

## 3) Definitions: Capability tiers (device + environment)

This is not “screen sizes”. It’s **what’s comfortable**.

Suggested FiskAI capability tiers (map to Tailwind breakpoints):

- **C0: Phone / Touch** (`< md`)
  - One-hand usage
  - Touch targets
  - Minimal scanning
  - Short sessions
- **C1: Tablet / Compact** (`md`–`< lg`)
  - More space, still touch-first
  - Can show more Tier 2 inline
- **C2: Desktop / Standard** (`lg`–`< xl`)
  - Scan + configure
  - Tier 3 becomes practical
- **C3: Desktop / Wide** (`>= xl`)
  - Side-by-side workflows
  - Persistent inspectors/side panels

**Important:** Capability tiers should change **presentation**, not business logic.

---

## 4) What we already do well in this repo (good patterns to standardize)

These are solid examples of “one component / one logic / multiple affordances”:

### 4.1 Single layout with responsive affordances (app shell)

- `src/app/(dashboard)/layout.tsx`
  - Desktop: sidebar (`hidden md:block`)
  - Mobile: drawer + bottom nav (`md:hidden`)
  - Same routes, same state, different navigation affordances

### 4.2 Mobile-first “collapse, don’t duplicate” (filters)

- `src/components/contacts/contact-filters.tsx`
  - Desktop: filters inline
  - Mobile: filters behind a button, expanded panel on demand
  - Same filter state + same URL behavior

### 4.3 Dense content transformed for mobile (knowledge hub)

- `src/components/knowledge-hub/comparison/ComparisonTable.tsx`
  - Desktop: sticky header + sticky first column
  - Mobile: “comparison cards” with option tabs
  - Same underlying data, different presentation

### 4.4 Mobile action affordances

- `src/components/layout/bottom-nav.tsx` (mobile bottom navigation + quick actions)
- `src/components/layout/mobile-action-bar.tsx` (fixed primary actions on mobile)

These are exactly the kinds of primitives we should replicate across the app.

### 4.5 Quick inventory (what exists vs. what’s duplicated)

**Navigation**

- Marketing: `src/components/marketing/MarketingHeader.tsx` + `src/components/marketing/PortalNavigation.tsx` (good pattern: few top links + “portal” for everything).
- App: `src/components/layout/header.tsx` + `src/components/layout/sidebar.tsx` + `src/components/layout/mobile-nav.tsx` + `src/components/layout/bottom-nav.tsx` (good pattern: desktop sidebar + mobile drawer + mobile bottom nav).

**Tables / dense data**

- `src/components/ui/responsive-table.tsx` (responsive _behavior_ exists, but styling is hard-coded light).
- `src/components/ui/data-table.tsx` (not responsive beyond scroll; hard-coded light).
- Domain tables with desktop-first affordances (example: `src/components/products/product-table.tsx`).

**Panels / sidebars**

- `src/components/documents/reports-sidebar.tsx` (responsive panel behavior exists, but uses hard-coded `bg-white` and duplicated layout strings).

**Action surfaces**

- `src/components/layout/mobile-action-bar.tsx` (good primitive; should become default for mobile “primary CTA”).
- `src/components/ui/fab.tsx` and `src/components/ui/command-palette/CommandPalette.tsx` (mobile quick actions; good capability-tier thinking).

**What this tells us**

- We already know _how_ to do responsive UX in a maintainable way.
- The gap is **standardization + enforcement** (so new work doesn’t invent new patterns or regress into desktop-only tables).

---

## 5) Where the gap is (what’s missing today)

### 5.1 No explicit tiering contract

We have good responsive code in places, but we don’t have a shared rule that forces:

- “What is Tier 1 on this page?”
- “What is Tier 3 and therefore desktop-only?”
- “How do we surface Tier 2 on mobile (sheet/drawer/accordion)?”

Without this, responsiveness becomes accidental and inconsistent.

### 5.2 Inconsistent “presentation modes” naming and approach

We already have multiple “modes” in the codebase, but they aren’t standardized:

- `variant="compact"` (e.g. `Fiskalizacija2Wizard`, `CountdownTimer`, `CompetenceSelector`)
- `compact?: boolean` (e.g. `CategoryCards`)
- `embedded={false}` (calculators)

This is good instinct, but without a standard, teams build new patterns each time.

### 5.3 Tables and dense data are handled inconsistently

We have several table primitives with different behavior and design:

- `src/components/ui/responsive-table.tsx` (has mobile cards + desktop table)
- `src/components/ui/data-table.tsx` (desktop table with overflow scroll)
- Many feature-specific tables (e.g. product table) that are desktop-first only

Problems:

- Some tables use overflow scrolling on mobile instead of a real mobile presentation (hard to use; feels broken).
- The existing primitives use hard-coded light colors (`gray-*`) instead of design tokens, so they can’t be reused across dark/neutral contexts.

### 5.4 “Mobile is for quick actions” is not consistently enforced

In some screens, mobile still gets:

- Too many equal-weight actions
- Inline power workflows (e.g., bulk editing) that are painful on touch

We need a rule system that forces the “one action at a time” model for C0.

### 5.5 We have the hook to do screen-size logic, but we should almost never use it

- `src/hooks/use-media-query.ts` exists (`useIsMobile`, `useMediaQuery`)

Right now it’s unused (good), but it’s a risk: teams often reach for this and start doing:

```ts
if (isMobile) doDifferentThing()
```

That’s where logic forks and long-term maintenance dies.

### 5.6 Capability tiers are broader than “width”

Some capabilities vary by device and should be treated as _capability tiers_, not as “special mobile code paths”:

- **Camera capture** (mobile-first): `src/components/documents/compact-dropzone.tsx` uses a camera capture affordance on `sm:hidden`.
- **Drag & drop vs file pickers**: same component can expose different affordances based on input method.
- **Passkeys / WebAuthn**: not “mobile vs desktop”, but “device supports this”.

**Guideline:** treat these as _affordance differences_ (presentation), not _logic differences_.
The data model and business rules should remain identical.

---

## 6) The system we should adopt (practical + enforceable)

### 6.1 A required “page tier map” (small, consistent, always present)

For every page/feature, maintain a short tier map (a comment or small object) that answers:

- Tier 1: primary action + primary data + context
- Tier 2: supportive info + secondary actions
- Tier 3: power features (desktop-only by default)

This is not for documentation vanity — it’s a forcing function for design clarity.

Example (documents list):

```md
Tier 1: search, document list, create/upload
Tier 2: category filter, status filter, sorting, saved views
Tier 3: bulk select/actions, inline editing, export presets, side inspector
```

### 6.2 Standardize “presentation modes” across components

Pick one naming convention that works everywhere.

Recommended:

- `density="compact" | "comfortable" | "dense"` (how much UI you show)
- `variant="default" | "compact" | "inline"` (shape/presentation)

Guidelines:

- Prefer `variant` for _shape_ differences (card vs inline vs hero)
- Prefer `density` for _information density_ (how many controls/columns)

### 6.3 Collapse patterns (Tier 2/3 on mobile)

On C0 (phone), Tier 2/3 should become one of:

- Bottom sheet (filters, secondary actions)
- Drawer (navigation, inspectors)
- Accordion (explanations, FAQs)
- Overflow menu (secondary actions)

**Rule:** Mobile should not require horizontal scrolling for primary tasks.
If the content is tabular, it becomes stacked cards, or becomes “view-only summary” with an explicit “open full view”.

### 6.4 “One primary action at a time” rule for mobile

On C0:

- Exactly one primary CTA visible
- Secondary actions go into:
  - overflow menu, or
  - bottom sheet, or
  - a secondary “More” button

If we feel discomfort hiding buttons, that’s a sign Tier 1 isn’t clear yet.

### 6.5 Breakpoints change layout, not business logic

Good:

- `md:hidden`, `lg:block`, `grid-cols-*` etc
- “same state, different affordance”

Avoid:

- `if (isMobile) { ... }` in business logic
- Fetching different data based on screen size
- Different validation rules per device

If viewport-specific behavior is unavoidable, keep it in a **presentation layer** only.

---

## 7) Concrete primitives to implement (so teams don’t reinvent this each time)

Create a small responsive toolkit and require teams to use it for dense UI.

### 7.1 `ActionBar` (Tier 1 action + Tier 2 overflow)

Responsibilities:

- Renders one primary CTA
- Renders secondary actions inline on desktop
- Collapses secondary actions into overflow menu on mobile
- Optional mobile fixed bar via `MobileActionBar`

### 7.2 `Filters` system (inline on desktop, sheet on mobile)

Pattern:

- Desktop: filters inline in the header row
- Mobile: “Filters” button opens a sheet

We already have a great example to generalize:

- `src/components/contacts/contact-filters.tsx`

### 7.3 `DataGrid` (table on desktop, cards on mobile)

Unify / replace:

- `src/components/ui/responsive-table.tsx`
- `src/components/ui/data-table.tsx`

Target behavior:

- Desktop: accessible table with sticky header option
- Mobile: stacked cards with:
  - key fields visible
  - row actions behind an overflow menu
  - optional “details” drawer

### 7.4 `InspectorPanel` (side panel → drawer)

Use for “select a row → see details”.

- Desktop: persistent side panel
- Mobile: drawer/bottom sheet

### 7.5 `DesktopOnly` / `MobileLimited` wrappers (capability gating)

Some workflows are genuinely desktop-first (bulk editing, reconciliation, deep reporting).
Instead of forcing them onto mobile, be explicit:

- On mobile: show a high-quality “This is best on desktop” screen with quick alternatives:
  - export
  - summary
  - send link to email
- On desktop: show full power UI

This is not “separate app”. It’s capability-tier acknowledgement.

### 7.6 Concrete API proposals (so it’s implementable)

**`DataGrid`**

```ts
type DataGridDensity = "compact" | "comfortable" | "dense"

type DataGridColumn<T> = {
  key: string
  header: string
  cell: (row: T) => React.ReactNode
  mobileSummary?: (row: T) => React.ReactNode // Tier 1 mobile view
  className?: string
}

type DataGridProps<T> = {
  caption: string
  density?: DataGridDensity
  columns: Array<DataGridColumn<T>>
  rows: T[]
  getRowKey: (row: T) => string
  rowActions?: (row: T) => React.ReactNode // overflow on mobile, inline on desktop
  emptyState?: React.ReactNode
}
```

**`ActionBar`**

```ts
type ActionBarProps = {
  title?: string
  primary: React.ReactNode
  secondary?: React.ReactNode // collapsed into overflow on mobile
  tertiary?: React.ReactNode // desktop-only by default
}
```

These keep “one logic path” while standardizing “mobile collapses” and “desktop power”.

---

## 8) Implementation pattern that prevents drift: Controller + View

To avoid logic forks:

- Put state + business logic in a **controller hook** (or server actions)
- Render with a **view component** that uses responsive affordances

Example structure:

```
useContactsFiltersController() // state, URL sync, actions
<ContactsFiltersView {...stateAndActions} /> // md:hidden drawers, etc
```

This keeps:

- state identical across tiers
- behaviors identical across tiers
- only presentation changes

---

## 9) Enforcement (the part most teams skip)

If this is optional, it will drift.
So enforcement must exist at 3 layers: docs, code, and review/testing.

### 9.1 One-page “Mobile Rules” document (required reading)

Create a single rules page and keep it short.

Proposed rules:

- Max 1 primary button visible on C0
- No sidebars on C0
- No multi-column grids on C0 unless they’re purely decorative
- No hover-only interactions
- Tables become cards (or become desktop-only with a deliberate fallback)
- Filters are hidden by default on C0 (sheet/drawer)
- Minimum touch target height 44px
- If something is Tier 3, it is desktop-only by default

Suggested location:

- `docs/design/mobile-rules.md` (or `docs/MOBILE_RULES.md` if you want it very visible)

### 9.2 PR checklist (cheap, high leverage)

Add to PR template:

- [ ] Tier map included/updated
- [ ] Mobile Tier 1 is complete (primary action + primary data + context)
- [ ] Tier 2/3 are collapsed on mobile
- [ ] No `isMobile` logic in business code
- [ ] Tested at phone + desktop widths

### 9.3 Linting / static checks (optional but very effective)

Suggested checks:

- Flag usage of `useIsMobile()` outside a `presentation` folder
- Flag `overflow-x-auto` tables inside dashboard routes unless paired with a mobile card view
- Flag new `DataTable` usage in dashboard without a responsive alternative

Even a simple “dangerfile” or custom eslint rule can catch 80% of drift.

### 9.4 Visual regression at 2–3 viewports (best long-term ROI)

Add Playwright snapshots for critical routes:

- C0 phone viewport
- C2 desktop viewport

Target: catch layout regressions early (especially navigation + action bars + tables).

### 9.5 Definition of Done (for a “responsive-ready” feature)

Before we call a feature “done”:

- Tier map exists (even if it’s a short comment in the page file).
- C0 supports Tier 1 fully (no missing primary action or context).
- Tier 2 is accessible but collapsed on C0.
- Tier 3 is either:
  - desktop-only with a deliberate fallback, or
  - available via an explicit “More / Advanced” affordance.

---

## 10) Migration plan (how to adopt without stopping shipping)

### Phase 1 (1–2 days): codify rules + stop the bleeding

- Add the one-page “Mobile Rules” doc
- Add PR checklist
- Decide the standard naming (`variant`/`density`)

### Phase 2 (2–5 days): unify primitives

- Introduce `DataGrid` and migrate:
  - documents list
  - banking transactions list
- Introduce `FiltersSheet` pattern and migrate:
  - any page with filters + a table

### Phase 3 (ongoing): capability-tier decisions for power workflows

- Identify “desktop-first” pages (bulk editing, reconciliation, deep reports)
- Add explicit C0 fallbacks (summary + export + “open on desktop”)
- Refactor gradually into Tier 1/2/3

---

## 11) Worked example: applying tiers to a real FiskAI screen

### Example: `/dashboard/banking/transactions`

(See: `src/app/(dashboard)/banking/transactions/page.tsx`, `src/components/ui/responsive-table.tsx`)

**Tier 1**

- View transactions list
- See amount/date/description and match status
- Primary action: “Connect / Match” (contextual)

**Tier 2**

- Filters (account/status/date)
- Sorting
- Quick stats (counts)

**Tier 3**

- Bulk match / bulk ignore
- Advanced columns and dense table controls
- Side inspector showing transaction + suggested matches

**C0 design**

- Tier 1 card list (already exists via `renderCard`)
- Filters behind a sheet/drawer (partially exists; should be standardized)
- Tier 3 hidden (bulk actions desktop-only)

**C2 design**

- Table visible
- Filters inline
- Optional inspector panel

The missing gap is not “more breakpoints”. The missing gap is:

- a single DataGrid primitive that does this consistently
- a tier map that explicitly calls out bulk actions as Tier 3 (desktop-only)

---

## 12) Summary: one sentence to remember

**Mobile decides what matters. Desktop decides how much.**

If we adopt this system (tiers + capability tiers + enforced primitives), we get:

- Faster shipping (fewer debates and rewrites)
- Consistent UX (mobile feels intentional, not compromised)
- Less maintenance (one logic path, multiple affordances)
- A product that feels premium on every device
