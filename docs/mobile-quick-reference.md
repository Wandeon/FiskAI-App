# Mobile Responsiveness - Quick Reference

## Component Imports

```typescript
// Hooks
import { useMediaQuery, useIsMobile } from "@/hooks/use-media-query"

// Components
import { MobileNav } from "@/components/layout/mobile-nav"
import { ResponsiveTable } from "@/components/ui/responsive-table"
import { FAB } from "@/components/ui/fab"
```

## Common Patterns

### 1. Detect Mobile Device

```typescript
const isMobile = useIsMobile() // true when width <= 768px
```

### 2. Conditional Rendering

```typescript
{isMobile ? (
  <MobileComponent />
) : (
  <DesktopComponent />
)}
```

### 3. Responsive Classes

```typescript
// Hide on mobile, show on desktop
<div className="hidden md:block">Desktop only</div>

// Show on mobile, hide on desktop
<div className="block md:hidden">Mobile only</div>

// Responsive sizing
<div className="text-sm md:text-base lg:text-lg">
<div className="p-4 md:p-6 lg:p-8">
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
```

### 4. Responsive Table

```typescript
<ResponsiveTable
  columns={[
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
  ]}
  data={users}
  getRowKey={(user) => user.id}
  renderCard={(user) => (
    <Card>
      <CardContent>
        <p>{user.name}</p>
        <p>{user.email}</p>
      </CardContent>
    </Card>
  )}
/>
```

### 5. Floating Action Button

```typescript
<FAB
  icon={<PlusIcon />}
  onClick={() => router.push('/create')}
  label="Add new item"
/>
```

## Tailwind Breakpoints

| Prefix | Min Width | Device        |
| ------ | --------- | ------------- |
| (none) | 0px       | Mobile first  |
| sm     | 640px     | Small tablet  |
| md     | 768px     | Tablet        |
| lg     | 1024px    | Desktop       |
| xl     | 1280px    | Large desktop |

## Common Responsive Utilities

### Spacing

- `p-4 md:p-6` - Padding
- `m-2 md:m-4` - Margin
- `gap-2 md:gap-4` - Grid/flex gap

### Layout

- `flex-col md:flex-row` - Stack mobile, row desktop
- `w-full md:w-1/2` - Full width mobile, half desktop
- `max-w-sm md:max-w-lg` - Max width responsive

### Typography

- `text-sm md:text-base lg:text-lg` - Font size
- `text-center md:text-left` - Text alignment

### Display

- `hidden md:block` - Hide mobile, show desktop
- `block md:hidden` - Show mobile, hide desktop
- `grid-cols-1 md:grid-cols-2` - Responsive columns

## Z-Index Layers

- **z-10**: Default overlay
- **z-20**: Modal backdrop
- **z-30**: FAB button
- **z-40**: Mobile nav backdrop
- **z-50**: Mobile nav sidebar

## Touch Target Sizes

Minimum sizes for mobile:

- Buttons: 44x44px
- Links: 44x44px
- Form inputs: 44px height
- Icons: 24x24px minimum

## Testing URLs

```
http://localhost:3000 - Desktop
http://localhost:3000?mobile=true - Force mobile view (optional)
```

## DevTools Testing

1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M / Cmd+Shift+M)
3. Select device or enter custom dimensions
4. Test at: 375px, 768px, 1024px, 1280px
