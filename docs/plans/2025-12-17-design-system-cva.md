# Design System: CVA + Hero Patterns

**Date:** 2025-12-17
**Issue:** #59 - Architecture: Enforce Consistent Styling via a Centralized Design System
**Status:** Approved

## Problem Statement

The application has inconsistent visual presentation across pages. The landing page hero looks premium with animations, gradients, and glassmorphism, while other pages (especially `/vijesti`) look basic with flat styling and hardcoded colors.

**Current state:**

- 243 hardcoded `bg-blue-*` colors
- 147 hardcoded `bg-gray-*` colors
- Only 7 `whileHover` instances (vs rich hero interactions)
- Design tokens exist but aren't used consistently

## Solution

Two-pronged approach:

1. **CVA-based primitives** - Type-safe component variants using `class-variance-authority`
2. **Hero pattern extraction** - Reusable motion and visual components from the landing hero

## Architecture

```
src/components/ui/
├── primitives/           # CVA-based building blocks
│   ├── button.tsx        # Gradient, glass, ghost variants
│   ├── card.tsx          # Glass, elevated, gradient variants
│   └── badge.tsx         # Tech, category, status variants
├── motion/               # Animation primitives
│   ├── Reveal.tsx        # (existing)
│   ├── Stagger.tsx       # (existing)
│   ├── GlowOrb.tsx       # Animated background orbs
│   ├── HoverScale.tsx    # whileHover wrapper
│   ├── FadeIn.tsx        # Simple fade animation
│   └── AnimatedGradientText.tsx
└── patterns/             # Composed components
    ├── SectionBackground.tsx  # Gradient + orbs + grid
    ├── GlassCard.tsx          # Glass card with hover
    └── GradientButton.tsx     # Primary CTA with motion
```

## CVA Variants

### Button

```typescript
export const buttonVariants = cva(
  "inline-flex items-center justify-center font-semibold transition-all duration-150
   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
   disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-gradient-to-r from-cyan-500 to-blue-600 text-white
                  shadow-lg shadow-cyan-500/25 hover:shadow-xl hover:shadow-cyan-500/30",
        secondary: "border border-white/20 bg-white/5 text-white backdrop-blur-sm
                    hover:bg-white/10 hover:border-white/30",
        ghost: "text-white/70 hover:text-white hover:bg-white/10",
        destructive: "bg-gradient-to-r from-red-500 to-rose-600 text-white
                      shadow-lg shadow-red-500/25",
        outline: "border border-border bg-surface text-foreground hover:bg-surface-secondary",
      },
      size: {
        sm: "h-9 px-3 text-sm rounded-lg",
        default: "h-11 px-6 text-base rounded-xl",
        lg: "h-14 px-8 text-lg rounded-xl",
        icon: "h-10 w-10 rounded-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  }
)
```

### Card

```typescript
export const cardVariants = cva(
  "rounded-2xl transition-all duration-200",
  {
    variants: {
      variant: {
        glass: "border border-white/10 bg-white/5 backdrop-blur-sm
                hover:border-white/20 hover:bg-white/10",
        elevated: "bg-surface border border-border shadow-card
                   hover:shadow-card-hover hover:-translate-y-0.5",
        gradient: "bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800
                   border border-white/10",
        flat: "bg-surface border border-border",
      },
      padding: {
        none: "",
        sm: "p-4",
        default: "p-6",
        lg: "p-8",
      },
    },
    defaultVariants: { variant: "glass", padding: "default" },
  }
)
```

### Badge

```typescript
export const badgeVariants = cva("inline-flex items-center gap-1.5 font-medium transition-colors", {
  variants: {
    variant: {
      tech: "border border-cyan-400/30 bg-cyan-500/10 text-cyan-300",
      category: "bg-blue-500/90 text-white",
      subtle: "bg-white/10 text-white/70",
      success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
      warning: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
      danger: "bg-red-500/10 text-red-400 border border-red-500/30",
    },
    size: {
      sm: "px-2 py-0.5 text-xs rounded-md",
      default: "px-3 py-1 text-sm rounded-full",
      lg: "px-4 py-1.5 text-sm rounded-full",
    },
  },
  defaultVariants: { variant: "subtle", size: "default" },
})
```

## Motion Components

### GlowOrb

Animated background orb with configurable color, size, position, and animation type.

### HoverScale

Simple wrapper that adds `whileHover={{ scale: 1.02 }}` and `whileTap={{ scale: 0.98 }}`.

### FadeIn

Lightweight fade-in animation, simpler than Reveal for basic use cases.

### AnimatedGradientText

Flowing gradient animation on text, like the hero headline.

## Pattern Components

### SectionBackground

Full hero-style background with gradient, animated orbs, and grid overlay.

### GlassCard

Pre-composed glass card combining `cardVariants("glass")` + `HoverScale` + optional glow.

### GradientButton

Pre-composed primary CTA with gradient, shadow, and arrow animation.

## Migration Plan

### Phase 1: Foundation

1. Install `class-variance-authority`
2. Create all primitive components
3. Create all motion components
4. Create all pattern components

### Phase 2: Vijesti (P1 - "horrible")

Transform 6 files:

- `src/app/(marketing)/vijesti/page.tsx`
- `src/components/news/HeroSection.tsx`
- `src/components/news/CategorySection.tsx`
- `src/components/news/DigestBanner.tsx`
- `src/components/news/PostCard.tsx`
- `src/app/(marketing)/vijesti/[slug]/page.tsx`

### Phase 3: Knowledge Hub

Transform 15 files across `/vodic`, `/usporedba`, `/alati`.

### Phase 4: Marketing Pages

Transform `/pricing`, `/features`, `/about`, etc.

## Usage Examples

**Before:**

```tsx
<button
  className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white
                   transition-colors hover:bg-blue-600"
>
  Pretplati se
</button>
```

**After:**

```tsx
<GradientButton size="sm">Pretplati se</GradientButton>
```

**Before:**

```tsx
<div className="rounded-xl border border-white/10 bg-white/5 p-6">...</div>
```

**After:**

```tsx
<GlassCard hover>...</GlassCard>
```

## Success Criteria

- [ ] All 10 new component files created
- [ ] CVA installed and working
- [ ] `/vijesti` transformed to premium look
- [ ] Hardcoded colors reduced by 80%+
- [ ] Consistent motion interactions across pages
