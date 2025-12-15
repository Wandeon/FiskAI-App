# Feature: Dashboard Action Cards

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 7

## Purpose

Dashboard Action Cards provide quick access to two advanced features of FiskAI: the AI Assistant for financial queries and the Accountant Workspace for collaborative accounting. These cards enable users to jump directly to specialized tools without navigating through the main menu.

## User Entry Points

| Type      | Path       | Evidence                                     |
| --------- | ---------- | -------------------------------------------- |
| Component | /dashboard | `src/app/(dashboard)/dashboard/page.tsx:271` |

## Core Flow

1. User logs into FiskAI and lands on the dashboard → `src/app/(dashboard)/dashboard/page.tsx:20`
2. ActionCards component renders in the right column of the dashboard grid → `src/app/(dashboard)/dashboard/page.tsx:271`
3. Component displays two cards with icons, descriptions, and action buttons → `src/components/dashboard/action-cards.tsx:9-46`
4. User clicks "Pokreni asistenta" (Launch Assistant) to navigate to `/assistant` → `src/components/dashboard/action-cards.tsx:20-25`
5. User clicks "Otvori workspace" (Open Workspace) to navigate to `/accountant` → `src/components/dashboard/action-cards.tsx:38-43`

## Key Modules

| Module         | Purpose                                              | Location                                    |
| -------------- | ---------------------------------------------------- | ------------------------------------------- |
| ActionCards    | Renders the two quick action cards for AI features   | `src/components/dashboard/action-cards.tsx` |
| AssistantPage  | Target page for FiskAI assistant (under development) | `src/app/(dashboard)/assistant/page.tsx`    |
| AccountantPage | Comprehensive accountant dashboard workspace         | `src/app/(dashboard)/accountant/page.tsx`   |

## Data

- **Tables**: None (purely navigational component)
- **Key fields**: N/A

## Quick Actions Available

### 1. FiskAI Assistant Card

- **Icon**: Brain (blue background) → `src/components/dashboard/action-cards.tsx:13`
- **Title**: "FiskAI asistent"
- **Description**: "Pitaj bilo što o financijama, računima ili zakonima" (Ask anything about finances, invoices, or laws)
- **Action Button**: "Pokreni asistenta" (Launch Assistant)
- **Navigation Target**: `/assistant` → `src/components/dashboard/action-cards.tsx:21`
- **Button Style**: Blue primary button (bg-blue-600)
- **Status**: Page shows "under development" message with quick actions

### 2. Accountant Workspace Card

- **Icon**: UserCog (emerald background) → `src/components/dashboard/action-cards.tsx:31`
- **Title**: "Workspace za računovođu"
- **Description**: "Vanjski računovođa radi direktno u FiskAI, bez eksportanja" (External accountant works directly in FiskAI, without exporting)
- **Action Button**: "Otvori workspace" (Open Workspace)
- **Navigation Target**: `/accountant` → `src/components/dashboard/action-cards.tsx:39`
- **Button Style**: White button with emerald border and text
- **Status**: Fully functional comprehensive accountant dashboard

## Accountant Workspace Features

The Accountant Workspace (`/accountant`) provides comprehensive accounting tools including:

- **Pending Actions**: Invoices awaiting approval, expenses needing processing, support tickets
- **VAT Threshold Progress**: Real-time tracking against 40,000 EUR threshold
- **Quick Reports**: Direct access to KPR, PO-SD, PDV, Archive packages, Aging reports
- **Monthly Revenue**: Current month financial overview
- **Direct Links**: E-invoices, expenses, and security settings

Evidence: `src/app/(dashboard)/accountant/page.tsx:46-455`

## Dependencies

- **Depends on**:
  - [[auth-session]] - User must be authenticated to access dashboard
  - Dashboard layout - ActionCards appear in the dashboard's right column
- **Depended by**: None (leaf feature providing navigation)

## Integrations

- **Lucide React Icons**: Brain and UserCog icons → `src/components/dashboard/action-cards.tsx:2`
- **Next.js Link**: Client-side navigation → `src/components/dashboard/action-cards.tsx:1`
- **CSS Variables**: Uses design system tokens for colors and styling → `src/components/dashboard/action-cards.tsx:10,12,28,30`

## Verification Checklist

- [x] User can see both action cards on dashboard
- [x] FiskAI Assistant card navigates to `/assistant`
- [x] Accountant Workspace card navigates to `/accountant`
- [x] Cards display correct icons and descriptions
- [x] Cards are responsive (2-column grid on medium+ screens)
- [x] Buttons have proper hover states and accessibility
- [x] Accountant workspace displays comprehensive metrics and tools

## Evidence Links

1. `src/components/dashboard/action-cards.tsx:1-47` - Complete ActionCards component implementation
2. `src/app/(dashboard)/dashboard/page.tsx:8` - ActionCards import statement
3. `src/app/(dashboard)/dashboard/page.tsx:271` - ActionCards rendered in dashboard grid
4. `src/app/(dashboard)/assistant/page.tsx:1-57` - FiskAI Assistant destination page
5. `src/app/(dashboard)/accountant/page.tsx:1-436` - Accountant Workspace destination page
6. `docs/_meta/inventory/components.json:36-40` - ActionCards component inventory entry
7. `src/components/dashboard/action-cards.tsx:20-25` - Assistant card button with navigation link
