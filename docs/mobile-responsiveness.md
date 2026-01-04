# Mobile Responsiveness - Phase 14

## Overview

FiskAI now includes comprehensive mobile responsiveness with custom hooks, components, and responsive layouts.

## Components Created

### 1. useMediaQuery Hook

Location: `/src/hooks/use-media-query.ts`

Custom React hook for media query matching:

```typescript
import { useMediaQuery, useIsMobile } from "@/hooks/use-media-query"

// Usage
const isMobile = useIsMobile() // true when screen width <= 768px
const isLarge = useMediaQuery("(min-width: 1024px)")
```

### 2. MobileNav Component

Location: `/src/components/layout/mobile-nav.tsx`

Responsive mobile navigation with slide-out sidebar:

**Features:**

- Hamburger menu button (visible only on mobile)
- Slide-out sidebar with smooth transitions
- Backdrop overlay for better UX
- Auto-close on navigation or backdrop click
- Uses same navigation items as desktop sidebar

**Styling:**

- Fixed positioning with z-index management
- Tailwind transition classes for smooth animations
- Responsive visibility (hidden on md+ screens)

### 3. Updated Dashboard Layout

Location: `/src/app/(dashboard)/layout.tsx`

**Changes:**

- Desktop sidebar hidden on mobile (`hidden md:block`)
- Mobile navigation component added
- Responsive padding on main content (`p-4 md:p-6`)
- Top padding adjustment for mobile menu button (`pt-16 md:pt-6`)

### 4. ResponsiveTable Component

Location: `/src/components/ui/responsive-table.tsx`

Intelligent table that adapts to screen size:

**Desktop:** Shows traditional table layout
**Mobile:** Shows card-based layout

**Usage Example:**

```typescript
import { ResponsiveTable } from '@/components/ui/responsive-table'

interface Invoice {
  id: string
  number: string
  date: string
  amount: number
}

const columns = [
  { key: 'number', label: 'Broj' },
  { key: 'date', label: 'Datum' },
  {
    key: 'amount',
    label: 'Iznos',
    render: (invoice: Invoice) => `€${invoice.amount.toFixed(2)}`
  },
]

const invoices: Invoice[] = [
  { id: '1', number: 'INV-001', date: '2024-01-15', amount: 1250.00 },
  { id: '2', number: 'INV-002', date: '2024-01-16', amount: 850.50 },
]

<ResponsiveTable
  columns={columns}
  data={invoices}
  getRowKey={(invoice) => invoice.id}
  renderCard={(invoice) => (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <span className="font-semibold text-gray-900">{invoice.number}</span>
        <span className="text-sm text-gray-500">{invoice.date}</span>
      </div>
      <div className="text-lg font-bold text-blue-600">
        €{invoice.amount.toFixed(2)}
      </div>
    </div>
  )}
/>
```

### 5. FAB Component

Location: `/src/components/ui/fab.tsx`

Floating Action Button that only appears on mobile:

**Features:**

- Only visible on mobile devices
- Fixed bottom-right positioning
- Customizable icon and action
- Accessible with aria-label support
- Smooth hover and active states

**Usage Example:**

```typescript
import { FAB } from '@/components/ui/fab'

<FAB
  icon={
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  }
  onClick={() => router.push('/invoices/new')}
  label="Dodaj novi račun"
/>
```

## Tailwind Breakpoints

FiskAI uses standard Tailwind breakpoints:

- **sm**: 640px (small tablets)
- **md**: 768px (tablets, mobile breakpoint)
- **lg**: 1024px (desktops)
- **xl**: 1280px (large desktops)

## Mobile-First Patterns

### Responsive Padding

```tsx
<div className="p-4 md:p-6">{/* 16px padding on mobile, 24px on desktop */}</div>
```

### Conditional Visibility

```tsx
<div className="hidden md:block">Desktop only</div>
<div className="block md:hidden">Mobile only</div>
```

### Responsive Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 1 column mobile, 2 tablet, 3 desktop */}
</div>
```

### Responsive Text

```tsx
<h1 className="text-2xl md:text-3xl lg:text-4xl">{/* Scales with screen size */}</h1>
```

## Best Practices

1. **Mobile-First**: Start with mobile styles, add larger breakpoints as needed
2. **Touch Targets**: Ensure buttons are at least 44x44px on mobile
3. **Readable Text**: Minimum 16px font size on mobile
4. **Spacing**: Use adequate padding/margin on mobile (min 16px)
5. **Performance**: Use `useMediaQuery` hook for client-side responsive logic

## Testing

Test responsiveness using browser DevTools:

1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test at different breakpoints:
   - Mobile: 375px (iPhone SE)
   - Tablet: 768px (iPad)
   - Desktop: 1280px

## Future Enhancements

- Swipe gestures for mobile navigation
- Pull-to-refresh functionality
- Progressive Web App (PWA) support
- Touch-optimized form controls
- Responsive charts and graphs
