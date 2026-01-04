# Phase 3-4: Tailwind Config & Typography Plugin

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update Tailwind config to only expose semantic tokens and add typography plugin.

**Architecture:** Override default colors (not extend) to make raw colors unavailable. Add typography component classes.

**Tech Stack:** Tailwind CSS, PostCSS Plugin

---

## Task 1: Create New Tailwind Config

**Files:**

- Modify: `tailwind.config.ts`

**Step 1: Backup current config**

```bash
cp tailwind.config.ts tailwind.config.ts.backup
```

**Step 2: Replace tailwind.config.ts**

```typescript
import type { Config } from "tailwindcss"
import { spacing, radius, shadows, zIndex } from "./src/design-system/tokens/layout"
import { fonts, textStyles } from "./src/design-system/tokens/typography"
import { categorical } from "./src/design-system/tokens/data-vis"
import tailwindcssAnimate from "tailwindcss-animate"
import tailwindcssTypography from "@tailwindcss/typography"
import plugin from "tailwindcss/plugin"

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    // ═══════════════════════════════════════════════════════════════
    // OVERRIDE (not extend) - Removes default Tailwind colors
    // This makes blue-600, red-500, etc. unavailable
    // ═══════════════════════════════════════════════════════════════

    spacing: spacing,
    borderRadius: radius,
    zIndex: zIndex,
    boxShadow: shadows,

    fontFamily: {
      sans: fonts.sans,
      heading: fonts.heading,
      mono: fonts.mono,
    },

    colors: {
      // Utility colors (always needed)
      transparent: "transparent",
      current: "currentColor",
      white: "#ffffff",
      black: "#000000",

      // ─────────────────────────────────────────────────────────────
      // SURFACE LADDER
      // ─────────────────────────────────────────────────────────────
      base: "var(--surface-base)",
      surface: {
        DEFAULT: "var(--surface-0)",
        1: "var(--surface-1)",
        2: "var(--surface-2)",
        elevated: "var(--surface-elevated)",
      },
      overlay: "var(--overlay)",

      // ─────────────────────────────────────────────────────────────
      // TEXT COLORS
      // ─────────────────────────────────────────────────────────────
      foreground: "var(--text-primary)",
      secondary: "var(--text-secondary)",
      tertiary: "var(--text-tertiary)",
      muted: "var(--text-disabled)",
      inverse: "var(--text-inverse)",
      link: "var(--text-link)",

      // ─────────────────────────────────────────────────────────────
      // INTERACTIVE COLORS
      // ─────────────────────────────────────────────────────────────
      interactive: {
        DEFAULT: "var(--interactive-primary)",
        hover: "var(--interactive-primary-hover)",
        secondary: "var(--interactive-secondary)",
        "secondary-hover": "var(--interactive-secondary-hover)",
        ghost: "var(--interactive-ghost)",
        "ghost-hover": "var(--interactive-ghost-hover)",
      },

      // ─────────────────────────────────────────────────────────────
      // BORDER COLORS
      // ─────────────────────────────────────────────────────────────
      border: {
        DEFAULT: "var(--border-default)",
        subtle: "var(--border-subtle)",
        strong: "var(--border-strong)",
        focus: "var(--border-focus)",
      },

      // ─────────────────────────────────────────────────────────────
      // STATUS COLORS (bundled bg/text/border)
      // ─────────────────────────────────────────────────────────────
      success: {
        DEFAULT: "var(--success)",
        bg: "var(--success-bg)",
        text: "var(--success-text)",
        border: "var(--success-border)",
        icon: "var(--success-icon)",
      },
      warning: {
        DEFAULT: "var(--warning)",
        bg: "var(--warning-bg)",
        text: "var(--warning-text)",
        border: "var(--warning-border)",
        icon: "var(--warning-icon)",
      },
      danger: {
        DEFAULT: "var(--danger)",
        bg: "var(--danger-bg)",
        text: "var(--danger-text)",
        border: "var(--danger-border)",
        icon: "var(--danger-icon)",
      },
      info: {
        DEFAULT: "var(--info)",
        bg: "var(--info-bg)",
        text: "var(--info-text)",
        border: "var(--info-border)",
        icon: "var(--info-icon)",
      },

      // ─────────────────────────────────────────────────────────────
      // ACCENT (Marketing)
      // ─────────────────────────────────────────────────────────────
      accent: {
        DEFAULT: "var(--accent)",
        light: "var(--accent-light)",
        dark: "var(--accent-dark)",
      },

      // ─────────────────────────────────────────────────────────────
      // CHART COLORS (Data Visualization)
      // ─────────────────────────────────────────────────────────────
      chart: {
        1: "var(--chart-series-1)",
        2: "var(--chart-series-2)",
        3: "var(--chart-series-3)",
        4: "var(--chart-series-4)",
        5: "var(--chart-series-5)",
        6: "var(--chart-series-6)",
        7: "var(--chart-series-7)",
        8: "var(--chart-series-8)",
        grid: "var(--chart-grid)",
        axis: "var(--chart-axis)",
      },
    },

    extend: {
      // ─────────────────────────────────────────────────────────────
      // ANIMATIONS (keep existing)
      // ─────────────────────────────────────────────────────────────
      animation: {
        "slide-in": "slideIn 0.2s ease-out",
        "slide-in-right": "slideInRight 0.2s ease-out",
        "slide-out": "slideOut 0.15s ease-in",
        "fade-in": "fadeIn var(--duration-normal) var(--ease-out)",
        "fade-out": "fadeOut var(--duration-fast) var(--ease-in)",
        "scale-in": "scaleIn var(--duration-normal) var(--ease-out)",
        "scale-out": "scaleOut var(--duration-fast) var(--ease-in)",
        "bounce-in": "bounceIn 0.3s var(--ease-spring)",
        "pulse-subtle": "pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "accordion-down": "accordionDown 0.2s ease-out",
        "accordion-up": "accordionUp 0.2s ease-out",
        "spin-slow": "spin 2s linear infinite",
      },
      keyframes: {
        slideIn: {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideOut: {
          "0%": { transform: "translateX(0)", opacity: "1" },
          "100%": { transform: "translateX(-100%)", opacity: "0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeOut: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        scaleOut: {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(0.95)", opacity: "0" },
        },
        bounceIn: {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        accordionDown: {
          "0%": { height: "0", opacity: "0" },
          "100%": { height: "var(--radix-accordion-content-height)", opacity: "1" },
        },
        accordionUp: {
          "0%": { height: "var(--radix-accordion-content-height)", opacity: "1" },
          "100%": { height: "0", opacity: "0" },
        },
      },
      transitionDuration: {
        "0": "0ms",
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
        slow: "var(--duration-slow)",
      },
      transitionTimingFunction: {
        "bounce-in": "var(--ease-spring)",
        smooth: "var(--ease-in-out)",
      },
      typography: {
        DEFAULT: {
          css: {
            color: "var(--text-primary)",
            a: {
              color: "var(--text-link)",
              textDecoration: "underline",
              textUnderlineOffset: "4px",
              fontWeight: "600",
            },
            strong: { color: "var(--text-primary)" },
            h1: { fontFamily: fonts.heading.join(", ") },
            h2: { fontFamily: fonts.heading.join(", ") },
            h3: { fontFamily: fonts.heading.join(", ") },
            h4: { fontFamily: fonts.heading.join(", ") },
            code: {
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-1)",
              padding: "0.15rem 0.35rem",
              borderRadius: radius.sm,
              border: "1px solid var(--border-default)",
              fontWeight: "600",
            },
            "code::before": { content: "''" },
            "code::after": { content: "''" },
            pre: {
              color: "var(--text-primary)",
              backgroundColor: "var(--surface-1)",
              border: "1px solid var(--border-default)",
              borderRadius: radius.lg,
            },
            "pre code": {
              backgroundColor: "transparent",
              border: "none",
              padding: "0",
              fontWeight: "500",
            },
            blockquote: {
              borderLeftColor: "var(--border-default)",
              color: "var(--text-primary)",
            },
            hr: { borderColor: "var(--border-default)" },
            "ul > li::marker": { color: "var(--text-disabled)" },
            "ol > li::marker": { color: "var(--text-disabled)" },
            thead: { borderBottomColor: "var(--border-default)" },
            "tbody tr": { borderBottomColor: "var(--border-default)" },
          },
        },
      },
    },
  },
  plugins: [
    tailwindcssAnimate,
    tailwindcssTypography,

    // ═══════════════════════════════════════════════════════════════
    // TYPOGRAPHY PLUGIN - Pre-composed text styles
    // ═══════════════════════════════════════════════════════════════
    plugin(function ({ addComponents }) {
      const typographyComponents: Record<string, Record<string, string>> = {}

      for (const [name, style] of Object.entries(textStyles)) {
        const componentClass = `.text-${name}`
        typographyComponents[componentClass] = {
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          fontWeight: style.fontWeight,
          ...(style.letterSpacing && { letterSpacing: style.letterSpacing }),
          ...(style.textTransform && { textTransform: style.textTransform }),
          ...(style.fontFamily && { fontFamily: style.fontFamily }),
        }
      }

      addComponents(typographyComponents)
    }),

    // ═══════════════════════════════════════════════════════════════
    // UTILITY CLASSES
    // ═══════════════════════════════════════════════════════════════
    plugin(function ({ addUtilities }) {
      addUtilities({
        // Focus ring
        ".focus-ring": {
          "@apply focus:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2":
            {},
        },
        // Card styles
        ".card": {
          backgroundColor: "var(--surface-0)",
          borderRadius: radius.lg,
          border: "1px solid var(--border-default)",
          boxShadow: shadows.card,
        },
        ".card-hover": {
          transition: "box-shadow 200ms, transform 200ms",
          "&:hover": {
            boxShadow: shadows.cardHover,
            transform: "translateY(-2px)",
          },
        },
        // Glass effect
        ".glass": {
          backgroundColor: "rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.18)",
        },
      })
    }),
  ],
}

export default config
```

---

## Task 2: Verify Tailwind Works

**Step 1: Run build to check for errors**

```bash
npm run build 2>&1 | head -50
```

Expected: Build starts (may have component errors from old color classes, but Tailwind should work)

**Step 2: Check that old colors are blocked**

Create a test file:

```bash
echo '<div className="text-blue-600 bg-red-500">Test</div>' > /tmp/test.tsx
npx tailwindcss -i src/app/globals.css -o /tmp/test.css --content /tmp/test.tsx 2>&1
grep -E "blue-600|red-500" /tmp/test.css && echo "FAIL: Old colors still work" || echo "PASS: Old colors blocked"
rm /tmp/test.tsx /tmp/test.css
```

Expected: "PASS: Old colors blocked"

---

## Task 3: Test Typography Classes

**Step 1: Verify typography classes are generated**

```bash
echo '<div className="text-heading-xl text-body-base text-display-lg">Test</div>' > /tmp/test.tsx
npx tailwindcss -i src/app/globals.css -o /tmp/test.css --content /tmp/test.tsx 2>&1
grep -E "text-heading-xl|text-body-base" /tmp/test.css && echo "PASS: Typography classes work" || echo "FAIL"
rm /tmp/test.tsx /tmp/test.css
```

Expected: "PASS: Typography classes work"

---

## Task 4: Commit Phase 3-4

**Step 1: Commit changes**

```bash
git add tailwind.config.ts tailwind.config.ts.backup
git commit -m "feat(design-system): restrictive Tailwind config + typography (phase 3-4)

- Override colors to only expose semantic tokens
- Block raw Tailwind colors (blue-600, red-500, etc.)
- Add surface ladder, text hierarchy, status colors
- Add typography plugin with text-heading-*, text-body-* classes
- Add card, glass, focus-ring utilities
- Use CSS custom properties for dark mode"
```

---

## Verification Checklist

- [ ] tailwind.config.ts backup created
- [ ] New config uses semantic colors only
- [ ] Raw Tailwind colors (blue-600, etc.) don't generate CSS
- [ ] Typography classes (text-heading-xl, etc.) work
- [ ] Surface classes (bg-surface, bg-surface-1) work
- [ ] Status classes (bg-success-bg, text-danger-text) work
- [ ] Build runs (component errors expected but Tailwind works)
- [ ] Commit created
