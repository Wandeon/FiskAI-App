# Feature: AI Assistant

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 14

## Purpose

The AI Assistant provides a conversational interface for users to ask questions about finances, invoices, and Croatian tax laws. While currently under development, it is positioned as a central feature of FiskAI's AI-first approach, offering intelligent assistance for financial queries and workflow automation. The assistant is prominently featured throughout the application as a future enhancement to streamline accounting tasks.

## User Entry Points

| Type      | Path       | Evidence                                       |
| --------- | ---------- | ---------------------------------------------- |
| Page      | /assistant | `src/app/(dashboard)/assistant/page.tsx:1`     |
| Component | Dashboard  | `src/components/dashboard/action-cards.tsx:10` |
| Component | Dashboard  | `src/components/dashboard/hero-banner.tsx:97`  |
| Palette   | Header     | `src/components/ui/command-palette.tsx:1`      |

## Core Flow

1. User navigates to /assistant via action cards, hero banner, or direct URL → `src/app/(dashboard)/assistant/page.tsx:4`
2. System displays placeholder page with "under development" message → `src/app/(dashboard)/assistant/page.tsx:13-15`
3. Page shows alternative quick actions: "New e-invoice" and "View contacts" → `src/app/(dashboard)/assistant/page.tsx:18-30`
4. Page displays feature cards explaining command palette (⌘K) and support resources → `src/app/(dashboard)/assistant/page.tsx:35-53`
5. Users can access command palette from header for quick navigation → `src/components/layout/header.tsx:127`

## Key Modules

| Module         | Purpose                                               | Location                                     |
| -------------- | ----------------------------------------------------- | -------------------------------------------- |
| AssistantPage  | Placeholder page for AI assistant (under development) | `src/app/(dashboard)/assistant/page.tsx`     |
| ActionCards    | Dashboard widget with assistant launcher              | `src/components/dashboard/action-cards.tsx`  |
| HeroBanner     | Dashboard banner with assistant CTA button            | `src/components/dashboard/hero-banner.tsx`   |
| CommandPalette | Quick navigation tool with ⌘K shortcut                | `src/components/ui/command-palette.tsx`      |
| InsightsCard   | Dashboard widget suggesting assistant use cases       | `src/components/dashboard/insights-card.tsx` |

## Current Implementation

### Assistant Page (Under Development)

The assistant page shows a placeholder with:

- **Title**: "FiskAI asistent" → `src/app/(dashboard)/assistant/page.tsx:13`
- **Status Message**: "Asistent je u izradi. U međuvremenu koristite postojeće brze akcije i pretragu kako biste došli do računa i kontakata bez klikanja kroz izbornik." → `src/app/(dashboard)/assistant/page.tsx:15`
- **Alternative Actions**:
  - Link to create new e-invoice (/e-invoices/new) → `src/app/(dashboard)/assistant/page.tsx:18-23`
  - Link to view contacts (/contacts) → `src/app/(dashboard)/assistant/page.tsx:24-29`
- **Feature Cards**:
  - Command palette (⌘K / Ctrl+K) information → `src/app/(dashboard)/assistant/page.tsx:36-43`
  - Support and documentation guidance → `src/app/(dashboard)/assistant/page.tsx:45-52`

### Dashboard Integration Points

#### 1. Action Cards Widget

Located in the right column of the dashboard → `src/app/(dashboard)/dashboard/page.tsx:271`

- **Icon**: Brain (blue background) → `src/components/dashboard/action-cards.tsx:13`
- **Title**: "FiskAI asistent"
- **Description**: "Pitaj bilo što o financijama, računima ili zakonima" → `src/components/dashboard/action-cards.tsx:17`
- **Button**: "Pokreni asistenta" (Launch Assistant) → `src/components/dashboard/action-cards.tsx:24`
- **Link**: Navigates to /assistant → `src/components/dashboard/action-cards.tsx:21`

#### 2. Hero Banner

Located at the top of the dashboard → `src/app/(dashboard)/dashboard/page.tsx:241-247`

- **Button**: "Pitaj FiskAI asistenta" with Sparkles icon → `src/components/dashboard/hero-banner.tsx:98-103`
- **Style**: White button with brand blue text → `src/components/dashboard/hero-banner.tsx:99`
- **Link**: Navigates to /assistant → `src/components/dashboard/hero-banner.tsx:98`

#### 3. Insights Card

Located in the right column of the dashboard → `src/app/(dashboard)/dashboard/page.tsx:264-269`

- **Insight Title**: "Iskoristite FiskAI asistenta" → `src/components/dashboard/insights-card.tsx:43`
- **Description**: "Pitajte asistenta da pronađe račune u nacrtu, kreira draft e-računa iz ponude ili pripremi podsjetnik za kupca." → `src/components/dashboard/insights-card.tsx:44-45`
- **Icon**: Sparkles (purple) → `src/components/dashboard/insights-card.tsx:46`

### Command Palette Integration

The command palette provides quick navigation as an interim solution:

- **Keyboard Shortcut**: ⌘K (Mac) or Ctrl+K (Windows/Linux) → `src/components/ui/command-palette.tsx:86-88`
- **Header Button**: Visible on desktop → `src/components/layout/header.tsx:127`
- **Search Placeholder**: "Pretražite module, stranice ili akcije..." → `src/components/ui/command-palette.tsx:155`
- **Features**:
  - Searches navigation items by label and description → `src/components/ui/command-palette.tsx:54-64`
  - Filters by module capabilities → `src/components/ui/command-palette.tsx:32-33`
  - Shows up to 10 results → `src/components/ui/command-palette.tsx:63`
  - Provides quick navigation to all app sections → `src/lib/navigation.ts:29-77`

## Business Context

### Croatian Market Focus

FiskAI is designed specifically for Croatian businesses with:

- **Croatian Language UI**: All text in Croatian → `src/app/(dashboard)/assistant/page.tsx:13-15`
- **Croatian Tax Terminology**: PDV (VAT), OIB (tax ID), fiskalizacija → `docs/design/architecture.md:19`
- **Local Compliance**: Focus on Fiskalizacija 2.0 / EN 16931 compliance → `docs/design/architecture.md:19`
- **Target Users**: Paušalni obrt (flat-rate businesses), VAT businesses, accountants → `src/app/(marketing)/page.tsx:137`

### AI-First Philosophy

The architecture emphasizes AI throughout:

- **Phase 1**: OCR & Smart Data Entry → `docs/design/architecture.md:519-531`
- **Phase 2**: Intelligent Automation (categorization, anomaly detection) → `docs/design/architecture.md:535-548`
- **Phase 3**: Conversational Assistant (natural language queries) → `docs/design/architecture.md:551-562`

Example planned queries:

- "Pokaži mi neplaćene račune iz prošlog mjeseca" (Show unpaid invoices from last month)
- "Koliki je PDV za ovaj kvartal?" (What's the VAT for this quarter?)
- "Napravi račun za klijenta X kao prošli put" (Create invoice for client X like last time)

Evidence: `docs/design/architecture.md:556-561`

## Planned Features (Future)

Based on architecture documentation → `docs/design/architecture.md:551-562`:

### Conversational Interface

- Natural language query processing
- Company context awareness
- Multi-turn conversations
- Financial data insights

### Smart Automation

- Invoice draft generation from prompts
- Customer reminder creation
- Document search and filtering
- Category suggestions

### Integration with AI Services

- **LLM**: OpenAI GPT-4 / Claude API → `docs/design/architecture.md:58`
- **Embeddings**: OpenAI embeddings for semantic search → `docs/design/architecture.md:59`
- **Context**: Full access to company data (invoices, contacts, products)

## Data

- **Tables**: None (currently placeholder, no data persistence)
- **Future Data**:
  - Conversation history
  - User feedback on suggestions
  - AI usage tracking → `docs/02_FEATURES/FEATURE_REGISTRY.md:105`

## Dependencies

- **Depends on**:
  - [[auth-session]] - User must be authenticated to access → `src/app/(dashboard)/layout.tsx:15-19`
  - [[dashboard-main]] - Primary entry point via action cards
  - [[command-palette]] - Alternative navigation during development

- **Depended by**: None (leaf feature under development)

## Integrations

### Current

- **Command Palette**: Interim solution for quick access → `src/components/ui/command-palette.tsx:1`
- **Navigation System**: Integrated with app-wide navigation → `src/lib/navigation.ts:29-77`

### Planned

- **AI API Integration**: OpenAI GPT-4 or Claude → `docs/design/architecture.md:58`
- **Company Context Service**: Access to all business data
- **E-Invoice API**: Direct invoice operations
- **Contact Management**: Customer/supplier queries
- **Reporting System**: Financial insights and analytics

## Verification Checklist

- [x] /assistant route is accessible to authenticated users
- [x] Placeholder page displays "under development" message
- [x] Action card appears on dashboard with correct icon and description
- [x] Hero banner includes assistant CTA button
- [x] Insights card suggests assistant use cases
- [x] Alternative actions (new e-invoice, contacts) work correctly
- [x] Command palette is accessible via ⌘K / Ctrl+K
- [x] Command palette searches all navigation items
- [x] Feature cards explain command palette and support
- [ ] Conversational interface implementation (planned)
- [ ] AI query processing (planned)
- [ ] Conversation history persistence (planned)

## Evidence Links

1. `src/app/(dashboard)/assistant/page.tsx:1-57` - Main assistant page implementation
2. `src/components/dashboard/action-cards.tsx:10-26` - Dashboard action card with assistant launcher
3. `src/components/dashboard/hero-banner.tsx:97-103` - Hero banner assistant CTA button
4. `src/components/dashboard/insights-card.tsx:42-47` - Insights card assistant recommendation
5. `src/app/(dashboard)/dashboard/page.tsx:271` - Action cards rendered in dashboard
6. `src/components/ui/command-palette.tsx:1-194` - Command palette implementation
7. `src/components/layout/header.tsx:127` - Command palette header integration
8. `src/lib/navigation.ts:29-77` - Navigation system for command palette
9. `docs/design/architecture.md:551-562` - Conversational assistant architecture plan
10. `docs/design/architecture.md:16-21` - AI-first core principles
11. `docs/02_FEATURES/FEATURE_REGISTRY.md:106` - Feature registry entry for AI Assistant
12. `docs/_meta/inventory/routes.json:77-82` - Route registration for /assistant
13. `docs/_meta/inventory/components.json:36-40` - ActionCards component inventory
14. `docs/_meta/inventory/components.json:414-418` - CommandPalette component inventory
