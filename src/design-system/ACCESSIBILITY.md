# Design System Accessibility Guide

This document outlines accessibility patterns and best practices for the FiskAI Design System, with special focus on motion and animation accessibility.

## Reduced Motion Support

FiskAI implements comprehensive reduced-motion support to respect user preferences and ensure accessibility for users with vestibular disorders or motion sensitivity.

### Overview

The design system provides three complementary approaches to reduced motion:

1. **Component-level**: Framer Motion's `useReducedMotion` hook
2. **CSS-level**: CSS custom properties with media queries
3. **Token-level**: Motion design tokens with reduced motion configuration

### User Preference Detection

The system respects the `prefers-reduced-motion` media query, which users can enable via:

- **macOS**: System Preferences → Accessibility → Display → Reduce Motion
- **Windows**: Settings → Ease of Access → Display → Show animations
- **iOS**: Settings → Accessibility → Motion → Reduce Motion
- **Android**: Settings → Accessibility → Remove animations

## Component-Level Implementation

### Using `useReducedMotion` Hook

For React components using Framer Motion, use the `useReducedMotion` hook to conditionally disable animations:

```tsx
import { motion, useReducedMotion } from "framer-motion"

export function AnimatedComponent() {
  const reduce = useReducedMotion()

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      Content
    </motion.div>
  )
}
```

### Pattern Examples

#### Reveal Component

The `Reveal` component demonstrates the standard pattern for scroll-triggered animations:

```tsx
// src/components/motion/Reveal.tsx
import { motion, useReducedMotion } from "framer-motion"

export function Reveal({ children, y = 12, delay = 0 }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -15% 0px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  )
}
```

**Key points:**

- `initial={reduce ? false : {...}}` - Skip initial state when motion is reduced
- `whileInView={reduce ? undefined : {...}}` - Disable animations when motion is reduced
- `transition` still defined but won't be used when animations are disabled

#### Stagger Component

The `Stagger` component shows how to handle staggered animations:

```tsx
// src/components/motion/Stagger.tsx
import { motion, useReducedMotion } from "framer-motion"

export function Stagger({ children }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      initial={reduce ? false : "hidden"}
      whileInView={reduce ? undefined : "show"}
      viewport={{ once: true }}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: 0.08, delayChildren: 0.05 },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      variants={
        reduce
          ? undefined
          : {
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0, transition: { duration: 0.55 } },
            }
      }
    >
      {children}
    </motion.div>
  )
}
```

**Key points:**

- Both parent and child components check `reduce`
- Parent uses named variants, children use variant objects
- When reduced, variants are set to `undefined` to skip all animations

### When to Use Which Approach

| Scenario                  | Pattern                                | Example             |
| ------------------------- | -------------------------------------- | ------------------- |
| Scroll-triggered reveal   | `initial/whileInView` with conditional | `<Reveal>`          |
| Staggered list animations | Parent/child variants with conditional | `<Stagger>`         |
| Hover effects             | Conditional `whileHover`               | Scale, glow effects |
| Page transitions          | Conditional `initial/animate`          | Route changes       |
| Loading states            | Conditional `animate`                  | Spinners, skeletons |

## CSS-Level Implementation

### CSS Custom Properties

All animation durations are defined as CSS custom properties that respond to `prefers-reduced-motion`:

```css
/* src/design-system/css/variables.css */

/* Default durations */
:root {
  --duration-instant: 0ms;
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 400ms;
}

/* Reduced motion: all durations become instant */
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-instant: 0ms;
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-slow: 0ms;
    --duration-slower: 0ms;
  }
}
```

### Using CSS Variables in Components

For CSS-based animations (not using Framer Motion), use the duration variables:

```css
.fade-in {
  animation: fadeIn var(--duration-normal) ease-out;
}

.hover-transition {
  transition: transform var(--duration-fast) ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

**Benefits:**

- Animations automatically respect reduced motion preference
- No JavaScript required for simple transitions
- Consistent timing across the application

## Token-Level Configuration

### Motion Design Tokens

Motion tokens include a `reducedMotion` configuration object:

```typescript
// src/design-system/tokens/motion.ts

export const reducedMotion = {
  /** Use instant duration for all animations */
  duration: duration.instant,
  /** Use linear easing (no acceleration) */
  easing: easing.linear,
  /** CSS media query for reduced motion preference */
  mediaQuery: "(prefers-reduced-motion: reduce)",
  /** Alternative fast duration if animation is essential */
  essentialDuration: duration.faster,
}
```

### When Animation is Essential

Some animations convey critical information and shouldn't be completely removed. In these cases:

1. Use `essentialDuration` (50-100ms) instead of instant
2. Simplify the animation (e.g., fade only, no movement)
3. Ensure information is still available without motion

```tsx
// Example: Loading indicator with essential motion
const reduce = useReducedMotion()

<motion.div
  animate={{
    opacity: reduce ? [1, 0.5, 1] : [1, 0.3, 1],
    scale: reduce ? 1 : [1, 1.1, 1],
  }}
  transition={{
    duration: reduce ? 0.1 : 0.5,
    repeat: Infinity,
  }}
/>
```

## Guidelines for Future Motion Components

When creating new motion components, follow these rules:

### 1. Always Check Reduced Motion Preference

```tsx
import { useReducedMotion } from "framer-motion"

export function NewMotionComponent() {
  const reduce = useReducedMotion()

  // Use 'reduce' to conditionally apply animations
}
```

### 2. Disable Animation Props Conditionally

Set animation props to `false` or `undefined` when motion is reduced:

```tsx
<motion.div
  initial={reduce ? false : { ... }}
  animate={reduce ? undefined : { ... }}
  whileHover={reduce ? undefined : { ... }}
  whileTap={reduce ? undefined : { ... }}
  transition={reduce ? { duration: 0 } : { ... }}
/>
```

### 3. Preserve Layout and Final State

Users with reduced motion still see the final state, just without the animation:

```tsx
// GOOD: Final state is visible
initial={reduce ? false : { opacity: 0 }}
animate={reduce ? undefined : { opacity: 1 }}

// BAD: Content stays invisible
initial={reduce ? { opacity: 0 } : { opacity: 0 }}
```

### 4. Consider Using CSS Variables

For simple transitions, prefer CSS variables over Framer Motion:

```tsx
<div className="transition-opacity" style={{ transitionDuration: "var(--duration-fast)" }} />
```

### 5. Test with Reduced Motion Enabled

Always test your components with `prefers-reduced-motion: reduce`:

**Chrome DevTools:**

1. Open DevTools (F12)
2. Open Command Palette (Cmd/Ctrl + Shift + P)
3. Type "Rendering"
4. Select "Show Rendering"
5. Check "Emulate CSS media feature prefers-reduced-motion"

**Firefox DevTools:**

1. Open DevTools (F12)
2. Open Accessibility Inspector
3. Check "Simulate" → "prefers-reduced-motion: reduce"

## Common Patterns

### Fade In on Scroll

```tsx
import { Reveal } from "@/components/motion/Reveal"

;<Reveal>
  <div>Content fades in when scrolled into view</div>
</Reveal>
```

### Staggered List

```tsx
import { Stagger, StaggerItem } from "@/components/motion/Stagger"

;<Stagger>
  {items.map((item) => (
    <StaggerItem key={item.id}>
      <div>{item.content}</div>
    </StaggerItem>
  ))}
</Stagger>
```

### Hover Scale Effect

```tsx
import { motion, useReducedMotion } from "framer-motion"

function Card() {
  const reduce = useReducedMotion()

  return (
    <motion.div whileHover={reduce ? undefined : { scale: 1.05 }} transition={{ duration: 0.2 }}>
      Card content
    </motion.div>
  )
}
```

### Page Transition

```tsx
import { motion, useReducedMotion } from "framer-motion"

function PageTransition({ children }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: -20 }}
      animate={reduce ? undefined : { opacity: 1, x: 0 }}
      exit={reduce ? undefined : { opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  )
}
```

## Accessibility Checklist

When implementing motion, ensure:

- [ ] `useReducedMotion` hook is used in all Framer Motion components
- [ ] Animation props are conditionally set to `false` or `undefined` when reduced
- [ ] Final state is visible regardless of motion preference
- [ ] CSS transitions use `var(--duration-*)` variables
- [ ] Essential animations use simplified versions, not complete removal
- [ ] Component has been tested with `prefers-reduced-motion: reduce`
- [ ] No infinite animations without user control (play/pause button)
- [ ] Parallax scrolling effects are disabled when motion is reduced

## Related Documentation

- [Motion Tokens](./tokens/motion.ts) - Animation duration and easing tokens
- [CSS Variables](./css/variables.css) - Global CSS custom properties
- [Component Library](../../docs/02_FEATURES/COMPONENT_LIBRARY.md) - Component inventory

## References

- [W3C WCAG 2.1 - Animation from Interactions](https://www.w3.org/WAI/WCAG21/Understanding/animation-from-interactions.html)
- [MDN - prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [Framer Motion - Accessibility](https://www.framer.com/motion/guide-accessibility/)
- [Vestibular Disorders Association](https://vestibular.org/article/coping-support/visual-motion-sensitivity/)
