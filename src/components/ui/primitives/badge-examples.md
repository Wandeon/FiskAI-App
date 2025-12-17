# Badge Component Usage Examples

## Basic Usage

```tsx
import { Badge } from "@/components/ui/primitives/badge"

// Default badge (subtle variant, default size)
<Badge>Default</Badge>

// With variant
<Badge variant="tech">TypeScript</Badge>
<Badge variant="category">News</Badge>
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="danger">Error</Badge>

// With size
<Badge size="sm">Small</Badge>
<Badge size="default">Default</Badge>
<Badge size="lg">Large</Badge>
```

## With Icons

```tsx
import { Badge } from "@/components/ui/primitives/badge"
import { CheckIcon, AlertTriangleIcon } from "lucide-react"

<Badge variant="success" icon={<CheckIcon className="h-3 w-3" />}>
  Verified
</Badge>

<Badge variant="warning" icon={<AlertTriangleIcon className="h-3 w-3" />}>
  Warning
</Badge>
```

## Combining Variants

```tsx
// Tech badge with small size
<Badge variant="tech" size="sm">React</Badge>

// Category badge with large size
<Badge variant="category" size="lg">Featured</Badge>

// Success badge with icon
<Badge variant="success" icon={<CheckIcon className="h-3 w-3" />}>
  Published
</Badge>
```

## Custom Styling

```tsx
// Override with custom classes
<Badge variant="tech" className="hover:scale-105">
  Hover Me
</Badge>

// Combine with additional styles
<Badge variant="subtle" className="uppercase tracking-wide">
  Label
</Badge>
```

## All Variants

### Tech Variant

- Border: `border-cyan-400/30`
- Background: `bg-cyan-500/10`
- Text: `text-cyan-300`

### Category Variant

- Background: `bg-blue-500/90`
- Text: `text-white`

### Subtle Variant (Default)

- Background: `bg-white/10`
- Text: `text-white/70`

### Success Variant

- Background: `bg-emerald-500/10`
- Text: `text-emerald-400`
- Border: `border-emerald-500/30`

### Warning Variant

- Background: `bg-amber-500/10`
- Text: `text-amber-400`
- Border: `border-amber-500/30`

### Danger Variant

- Background: `bg-red-500/10`
- Text: `text-red-400`
- Border: `border-red-500/30`

## All Sizes

### Small (sm)

- Padding: `px-2 py-0.5`
- Text: `text-xs`
- Border Radius: `rounded-md`

### Default

- Padding: `px-3 py-1`
- Text: `text-sm`
- Border Radius: `rounded-full`

### Large (lg)

- Padding: `px-4 py-1.5`
- Text: `text-sm`
- Border Radius: `rounded-full`

## Using badgeVariants directly

```tsx
import { badgeVariants } from "@/components/ui/primitives/badge"
import { cn } from "@/lib/utils"

// In a custom component
;<div className={cn(badgeVariants({ variant: "tech", size: "sm" }), "custom-class")}>
  Custom Badge
</div>
```
