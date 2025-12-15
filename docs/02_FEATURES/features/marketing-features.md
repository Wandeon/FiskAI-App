# Feature: Features Page (F093)

## Status

- Documentation: ✅ Complete
- Last verified: 2025-12-15
- Evidence count: 12

## Purpose

The Features Page (`/features`) is a public-facing marketing page that showcases FiskAI's core product capabilities to potential customers. The page presents six key product features using a modular card-based layout with icons, emphasizing the platform's AI-first approach, Croatian market focus, and beta stage transparency. It serves as a central hub for educating visitors about FiskAI's capabilities before they sign up.

## User Entry Points

| Type     | Path                  | Evidence                                   |
| -------- | --------------------- | ------------------------------------------ |
| Page     | GET /features         | `src/app/(marketing)/features/page.tsx:11` |
| Route    | Marketing Route       | `docs/_meta/inventory/routes.json:228-232` |
| Nav Link | Marketing Navigation  | `src/app/(marketing)/layout.tsx:61`        |
| Footer   | Marketing Footer      | `src/app/(marketing)/layout.tsx:102`       |
| Internal | Homepage CTA Link     | `src/app/(marketing)/page.tsx:80`          |
| SEO      | Sitemap Entry         | `src/app/sitemap.ts:13`                    |
| SEO      | Robots.txt Allow Rule | `src/app/robots.ts:15`                     |

## Core Flow

1. User visits /features URL or clicks "Mogućnosti" in navigation → `src/app/(marketing)/layout.tsx:61`
2. Next.js renders FeaturesPage component with metadata → `src/app/(marketing)/features/page.tsx:6-9`
3. System applies marketing layout with header and footer → `src/app/(marketing)/layout.tsx:44-148`
4. Page displays hero section with title and introduction → `src/app/(marketing)/features/page.tsx:13-19`
5. System renders 6 feature cards in responsive grid (2 cols on desktop) → `src/app/(marketing)/features/page.tsx:21-98`
6. Each card displays lucide-react icon, title, and description → `src/app/(marketing)/features/page.tsx:22-44`
7. Security card includes "Pročitaj više" link to /security → `src/app/(marketing)/features/page.tsx:92-95`
8. User can navigate to other marketing pages via header/footer links → `src/app/(marketing)/layout.tsx:60-65`

## Key Modules

| Module            | Purpose                                         | Location                                       |
| ----------------- | ----------------------------------------------- | ---------------------------------------------- |
| FeaturesPage      | Main page component rendering features showcase | `src/app/(marketing)/features/page.tsx:11-101` |
| MarketingLayout   | Shared layout with navigation and footer        | `src/app/(marketing)/layout.tsx:44-148`        |
| Card Components   | Reusable UI card primitives                     | `src/components/ui/card.tsx:4-58`              |
| Lucide Icons      | Icon library for visual feature indicators      | `package.json:55` (lucide-react)               |
| Sitemap Generator | SEO sitemap including /features route           | `src/app/sitemap.ts:9-20`                      |
| Robots.txt Config | SEO robots configuration allowing /features     | `src/app/robots.ts:9-21`                       |

## Feature Cards Displayed

### 1. Računi (Invoices)

- **Icon**: FileText (blue)
- **Description**: Creating, sending, and tracking invoices with statuses, customers, items, templates, and exports
- **Location**: `src/app/(marketing)/features/page.tsx:22-32`

### 2. Troškovi + skeniranje (Expenses + Scanning)

- **Icon**: ScanText (blue)
- **Description**: Scan invoice, automatically extract data, and confirm entry (AI/OCR)
- **Location**: `src/app/(marketing)/features/page.tsx:34-44`

### 3. E-računi i fiskalizacija 2.0 (E-Invoices and Fiscalization 2.0)

- **Icon**: Landmark (blue)
- **Description**: Preparation for integration with information intermediaries (e.g., IE-Računi) and tracking e-invoice status (in development)
- **Location**: `src/app/(marketing)/features/page.tsx:46-56`

### 4. Suradnja s knjigovođom (Accountant Collaboration)

- **Icon**: Users (blue)
- **Description**: Exports and audit trail enable collaboration without "folders" and manual rewriting
- **Location**: `src/app/(marketing)/features/page.tsx:58-68`

### 5. AI-first princip (AI-First Principle)

- **Icon**: Sparkles (blue)
- **Description**: AI never "changes truth" without user confirmation: suggestions are visible, reversible, and (ideally) auditable
- **Full width card** (spans 2 columns on desktop)
- **Location**: `src/app/(marketing)/features/page.tsx:70-80`

### 6. Sigurnost i privatnost (Security and Privacy)

- **Icon**: Shield (blue)
- **Description**: FiskAI should have a clear "Trust Center": where data is stored, retention periods, export/deletion, and AI processing
- **Full width card** (spans 2 columns on desktop)
- **Includes CTA**: "Pročitaj više" link to /security page
- **Location**: `src/app/(marketing)/features/page.tsx:82-97`

## SEO & Metadata

| Property         | Value                                                                                          | Location                                  |
| ---------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Page Title       | "FiskAI — Mogućnosti"                                                                          | `src/app/(marketing)/features/page.tsx:7` |
| Meta Description | "Pregled mogućnosti FiskAI platforme (beta): računi, troškovi, AI/OCR i priprema za e-račune." | `src/app/(marketing)/features/page.tsx:8` |
| Sitemap Priority | 0.7                                                                                            | `src/app/sitemap.ts:18`                   |
| Change Frequency | weekly                                                                                         | `src/app/sitemap.ts:18`                   |
| Robots Allow     | Yes (explicitly allowed for all user agents)                                                   | `src/app/robots.ts:15`                    |

## Design & Styling

| Element           | Implementation                                    | Evidence                                   |
| ----------------- | ------------------------------------------------- | ------------------------------------------ |
| Container         | Max-width 6xl (1280px) with responsive padding    | `src/app/(marketing)/features/page.tsx:13` |
| Grid Layout       | 2-column grid on md+ breakpoints                  | `src/app/(marketing)/features/page.tsx:21` |
| Card Style        | "card card-hover" classes                         | `src/app/(marketing)/features/page.tsx:22` |
| Icon Color        | text-blue-600                                     | `src/app/(marketing)/features/page.tsx:25` |
| Typography        | text-display, text-4xl, font-semibold for heading | `src/app/(marketing)/features/page.tsx:15` |
| Component Library | shadcn/ui Card components                         | `src/components/ui/card.tsx:4-58`          |

## Navigation Integration

The Features page is integrated into marketing site navigation:

- **Header Navigation**: "Mogućnosti" link in desktop nav → `src/app/(marketing)/layout.tsx:61`
- **Footer Navigation**: Listed under "Linkovi" section → `src/app/(marketing)/layout.tsx:102`
- **Homepage CTA**: "Pogledaj mogućnosti" link in beta transparency card → `src/app/(marketing)/page.tsx:80`
- **Beta Badge**: Marketing header includes beta indicator → `src/app/(marketing)/layout.tsx:55-57`

## Technical Implementation

### Route Configuration

```typescript
{
  "path": "/features",
  "file": "src/app/(marketing)/features/page.tsx",
  "type": "page",
  "routeGroup": null
}
```

**Evidence**: `docs/_meta/inventory/routes.json:228-232`

### Metadata Export

```typescript
export const metadata: Metadata = {
  title: "FiskAI — Mogućnosti",
  description:
    "Pregled mogućnosti FiskAI platforme (beta): računi, troškovi, AI/OCR i priprema za e-račune.",
}
```

**Evidence**: `src/app/(marketing)/features/page.tsx:6-9`

### Card Component Structure

```typescript
<Card className="card card-hover">
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-blue-600" />
      Title
    </CardTitle>
  </CardHeader>
  <CardContent className="text-sm text-[var(--muted)]">
    Description
  </CardContent>
</Card>
```

**Evidence**: `src/app/(marketing)/features/page.tsx:22-32`

## Related Features

- **Homepage** (`/`): Links to features page via beta transparency card
- **Security Page** (`/security`): Linked from Security & Privacy feature card
- **Marketing Layout**: Shared navigation and footer components
- **Pricing Page** (`/pricing`): Common navigation destination from features

## Evidence Links

1. **Page Component**: `src/app/(marketing)/features/page.tsx:11` - FeaturesPage component definition
2. **Route Registry**: `docs/_meta/inventory/routes.json:228-232` - Official route registration
3. **Metadata**: `src/app/(marketing)/features/page.tsx:6-9` - SEO title and description
4. **Navigation Link**: `src/app/(marketing)/layout.tsx:61` - Header navigation "Mogućnosti"
5. **Footer Link**: `src/app/(marketing)/layout.tsx:102` - Footer "Linkovi" section
6. **Homepage CTA**: `src/app/(marketing)/page.tsx:80` - "Pogledaj mogućnosti" link
7. **Sitemap Entry**: `src/app/sitemap.ts:13` - /features in sitemap routes array
8. **Robots.txt**: `src/app/robots.ts:15` - /features in allowed routes
9. **Card Components**: `src/components/ui/card.tsx:4-58` - Card, CardHeader, CardTitle, CardContent primitives
10. **Icon Library**: `package.json:55` - lucide-react dependency for icons
11. **Feature Cards**: `src/app/(marketing)/features/page.tsx:21-98` - Grid of 6 feature cards
12. **Security CTA**: `src/app/(marketing)/features/page.tsx:92-95` - "Pročitaj više" link to /security

## Notes

- Page content is in Croatian language (HR)
- Beta stage is transparently communicated in page copy
- Icons are consistently blue (#2563eb / text-blue-600)
- Two cards (AI-first, Security) span full width for emphasis
- Only Security card includes a call-to-action link
- Page is fully responsive with mobile-first design
- Uses Next.js 15 App Router with server components
- Part of public marketing site (no authentication required)
