# Phase 3: Mode Differentiation - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement UI differentiation based on user competence level - tooltips for beginners, safety net for average users, dense UI & shortcuts for pros.

**Architecture:** GuidanceContext provides global access to user's level. Components conditionally render based on level. CSS classes enable dense mode styling.

**Tech Stack:** React Context, Tailwind CSS variants, existing CommandPalette integration.

**Prerequisites:** Phase 1 & 2 complete (schema, API, UI components exist)

---

## Task 3.1: Create GuidanceContext Provider

**Files:**

- Create: `src/contexts/GuidanceContext.tsx`
- Create: `src/contexts/index.ts`

**Step 1: Create the context**

```typescript
// src/contexts/GuidanceContext.tsx
"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import {
  COMPETENCE_LEVELS,
  GUIDANCE_CATEGORIES,
  type CompetenceLevel,
  type GuidanceCategory,
} from "@/lib/guidance/constants"

interface GuidancePreferences {
  levelFakturiranje: CompetenceLevel
  levelFinancije: CompetenceLevel
  levelEu: CompetenceLevel
  globalLevel: CompetenceLevel | null
}

interface GuidanceContextType {
  preferences: GuidancePreferences
  isLoading: boolean
  getLevel: (category: GuidanceCategory) => CompetenceLevel
  setLevel: (category: GuidanceCategory | "global", level: CompetenceLevel) => Promise<void>
  shouldShowTooltip: (category: GuidanceCategory) => boolean
  shouldShowWizard: (category: GuidanceCategory) => boolean
  isDenseMode: () => boolean
}

const defaultPreferences: GuidancePreferences = {
  levelFakturiranje: "beginner",
  levelFinancije: "beginner",
  levelEu: "beginner",
  globalLevel: null,
}

const GuidanceContext = createContext<GuidanceContextType | null>(null)

export function GuidanceProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<GuidancePreferences>(defaultPreferences)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch preferences on mount
  useEffect(() => {
    async function fetchPreferences() {
      try {
        const res = await fetch("/api/guidance/preferences")
        if (res.ok) {
          const data = await res.json()
          setPreferences({
            levelFakturiranje: data.preferences.levelFakturiranje || "beginner",
            levelFinancije: data.preferences.levelFinancije || "beginner",
            levelEu: data.preferences.levelEu || "beginner",
            globalLevel: data.preferences.globalLevel || null,
          })
        }
      } catch (error) {
        console.error("Failed to fetch guidance preferences:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchPreferences()
  }, [])

  const getLevel = useCallback(
    (category: GuidanceCategory): CompetenceLevel => {
      if (preferences.globalLevel) return preferences.globalLevel

      switch (category) {
        case "fakturiranje":
          return preferences.levelFakturiranje
        case "financije":
          return preferences.levelFinancije
        case "eu":
          return preferences.levelEu
        default:
          return "beginner"
      }
    },
    [preferences]
  )

  const setLevel = useCallback(
    async (category: GuidanceCategory | "global", level: CompetenceLevel) => {
      try {
        const body =
          category === "global"
            ? { globalLevel: level }
            : { [`level${category.charAt(0).toUpperCase() + category.slice(1)}`]: level }

        const res = await fetch("/api/guidance/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })

        if (res.ok) {
          const data = await res.json()
          setPreferences({
            levelFakturiranje: data.preferences.levelFakturiranje,
            levelFinancije: data.preferences.levelFinancije,
            levelEu: data.preferences.levelEu,
            globalLevel: data.preferences.globalLevel,
          })
        }
      } catch (error) {
        console.error("Failed to update guidance level:", error)
      }
    },
    []
  )

  const shouldShowTooltip = useCallback(
    (category: GuidanceCategory): boolean => {
      const level = getLevel(category)
      return level === "beginner"
    },
    [getLevel]
  )

  const shouldShowWizard = useCallback(
    (category: GuidanceCategory): boolean => {
      const level = getLevel(category)
      return level === "beginner" || level === "average"
    },
    [getLevel]
  )

  const isDenseMode = useCallback((): boolean => {
    // Dense mode if ALL categories are pro, or global is pro
    if (preferences.globalLevel === "pro") return true
    return (
      preferences.levelFakturiranje === "pro" &&
      preferences.levelFinancije === "pro" &&
      preferences.levelEu === "pro"
    )
  }, [preferences])

  return (
    <GuidanceContext.Provider
      value={{
        preferences,
        isLoading,
        getLevel,
        setLevel,
        shouldShowTooltip,
        shouldShowWizard,
        isDenseMode,
      }}
    >
      {children}
    </GuidanceContext.Provider>
  )
}

export function useGuidance() {
  const context = useContext(GuidanceContext)
  if (!context) {
    throw new Error("useGuidance must be used within a GuidanceProvider")
  }
  return context
}

export function useGuidanceLevel(category: GuidanceCategory) {
  const { getLevel, shouldShowTooltip, shouldShowWizard } = useGuidance()
  return {
    level: getLevel(category),
    showTooltip: shouldShowTooltip(category),
    showWizard: shouldShowWizard(category),
  }
}
```

**Step 2: Create index export**

```typescript
// src/contexts/index.ts
export * from "./GuidanceContext"
```

**Step 3: Commit**

```bash
git add src/contexts/
git commit -m "feat(guidance): add GuidanceContext for global preference access"
```

---

## Task 3.2: Create HelpTooltip Component

**Files:**

- Create: `src/components/guidance/HelpTooltip.tsx`
- Update: `src/components/guidance/index.ts`

**Step 1: Create the component**

```typescript
// src/components/guidance/HelpTooltip.tsx
"use client"

import { useState, type ReactNode } from "react"
import { HelpCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface HelpTooltipProps {
  content: string
  title?: string
  category?: "fakturiranje" | "financije" | "eu"
  position?: "top" | "bottom" | "left" | "right"
  className?: string
  children?: ReactNode
  forceShow?: boolean // Override visibility check
}

export function HelpTooltip({
  content,
  title,
  category = "fakturiranje",
  position = "top",
  className,
  children,
  forceShow = false,
}: HelpTooltipProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Position classes
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }

  const arrowClasses = {
    top: "-bottom-1.5 left-1/2 -translate-x-1/2 rotate-45 border-b border-r",
    bottom: "-top-1.5 left-1/2 -translate-x-1/2 rotate-45 border-t border-l",
    left: "-right-1.5 top-1/2 -translate-y-1/2 rotate-45 border-t border-r",
    right: "-left-1.5 top-1/2 -translate-y-1/2 rotate-45 border-b border-l",
  }

  return (
    <span className={cn("relative inline-flex items-center gap-1", className)}>
      {children}
      <button
        type="button"
        className="inline-flex text-white/40 hover:text-white/70 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1 rounded-full transition-colors"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Pomoć: ${title || content.substring(0, 30)}`}
        aria-expanded={isOpen}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className={cn(
            "absolute z-50 w-64 rounded-lg border border-white/10 bg-slate-800 p-3 shadow-xl",
            positionClasses[position]
          )}
        >
          {title && (
            <div className="font-semibold text-sm text-white mb-1">{title}</div>
          )}
          <div className="text-xs text-white/70 leading-relaxed">{content}</div>
          <div
            className={cn(
              "absolute h-3 w-3 border-white/10 bg-slate-800",
              arrowClasses[position]
            )}
          />
        </div>
      )}
    </span>
  )
}

// Wrapper that respects guidance level
interface ConditionalHelpTooltipProps extends HelpTooltipProps {
  showForLevels?: ("beginner" | "average" | "pro")[]
}

export function ConditionalHelpTooltip({
  showForLevels = ["beginner"],
  ...props
}: ConditionalHelpTooltipProps) {
  // For now, always show - context will be integrated in Task 3.4
  // This allows components to use it without context being set up yet
  return <HelpTooltip {...props} />
}
```

**Step 2: Update exports**

Add to `src/components/guidance/index.ts`:

```typescript
export * from "./HelpTooltip"
```

**Step 3: Commit**

```bash
git add src/components/guidance/
git commit -m "feat(guidance): add HelpTooltip component for contextual help"
```

---

## Task 3.3: Create Quick-Toggle Component

**Files:**

- Create: `src/components/guidance/QuickLevelToggle.tsx`
- Update: `src/components/guidance/index.ts`

**Step 1: Create the component**

```typescript
// src/components/guidance/QuickLevelToggle.tsx
"use client"

import { useState, useEffect } from "react"
import { Sparkles, Gauge, Zap, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { COMPETENCE_LEVELS, LEVEL_LABELS, type CompetenceLevel } from "@/lib/guidance/constants"

interface QuickLevelToggleProps {
  className?: string
  variant?: "dropdown" | "buttons"
}

const levelIcons = {
  beginner: Sparkles,
  average: Gauge,
  pro: Zap,
}

const levelColors = {
  beginner: "text-emerald-400",
  average: "text-amber-400",
  pro: "text-cyan-400",
}

export function QuickLevelToggle({ className, variant = "dropdown" }: QuickLevelToggleProps) {
  const [currentLevel, setCurrentLevel] = useState<CompetenceLevel>("beginner")
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch current global level
  useEffect(() => {
    async function fetchLevel() {
      try {
        const res = await fetch("/api/guidance/preferences")
        if (res.ok) {
          const data = await res.json()
          // Use global level or determine from individual levels
          const level =
            data.preferences.globalLevel ||
            (data.preferences.levelFakturiranje === data.preferences.levelFinancije &&
            data.preferences.levelFinancije === data.preferences.levelEu
              ? data.preferences.levelFakturiranje
              : "beginner")
          setCurrentLevel(level)
        }
      } catch (error) {
        console.error("Failed to fetch level:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchLevel()
  }, [])

  const handleSetLevel = async (level: CompetenceLevel) => {
    setCurrentLevel(level)
    setIsOpen(false)

    try {
      await fetch("/api/guidance/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ globalLevel: level }),
      })
    } catch (error) {
      console.error("Failed to update level:", error)
    }
  }

  const CurrentIcon = levelIcons[currentLevel]
  const levels = Object.values(COMPETENCE_LEVELS) as CompetenceLevel[]

  if (variant === "buttons") {
    return (
      <div className={cn("flex gap-1", className)}>
        {levels.map((level) => {
          const Icon = levelIcons[level]
          const isActive = currentLevel === level
          return (
            <button
              key={level}
              onClick={() => handleSetLevel(level)}
              disabled={isLoading}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all",
                isActive
                  ? `bg-white/10 ${levelColors[level]}`
                  : "text-white/50 hover:text-white/70 hover:bg-white/5"
              )}
              title={LEVEL_LABELS[level]}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{LEVEL_LABELS[level]}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className={cn(
          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-all",
          "bg-white/5 hover:bg-white/10 border border-white/10",
          levelColors[currentLevel]
        )}
      >
        <CurrentIcon className="h-4 w-4" />
        <span className="hidden sm:inline">{LEVEL_LABELS[currentLevel]}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-white/10 bg-slate-800 py-1 shadow-xl">
            <div className="px-3 py-2 text-xs text-white/50 border-b border-white/10">
              Razina pomoći
            </div>
            {levels.map((level) => {
              const Icon = levelIcons[level]
              const isActive = currentLevel === level
              return (
                <button
                  key={level}
                  onClick={() => handleSetLevel(level)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                    isActive
                      ? `${levelColors[level]} bg-white/5`
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{LEVEL_LABELS[level]}</span>
                  {isActive && <span className="ml-auto text-xs">✓</span>}
                </button>
              )
            })}
            <div className="px-3 py-2 text-xs text-white/40 border-t border-white/10">
              <a href="/settings/guidance" className="hover:text-white/60">
                Više opcija →
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
```

**Step 2: Update exports**

Add to `src/components/guidance/index.ts`:

```typescript
export * from "./QuickLevelToggle"
```

**Step 3: Commit**

```bash
git add src/components/guidance/
git commit -m "feat(guidance): add QuickLevelToggle for fast level switching"
```

---

## Task 3.4: Add Quick-Toggle to Header

**Files:**

- Modify: `src/components/layout/header.tsx`

**Step 1: Add import**

Add at top of file:

```typescript
import { QuickLevelToggle } from "@/components/guidance"
```

**Step 2: Add toggle to header**

In the right section (before CommandPalette), add:

```tsx
<QuickLevelToggle className="hidden md:flex" />
```

**Step 3: TypeScript check and commit**

```bash
npx tsc --noEmit src/components/layout/header.tsx
git add src/components/layout/
git commit -m "feat(guidance): add QuickLevelToggle to header"
```

---

## Task 3.5: Create Dense Mode CSS Utilities

**Files:**

- Create: `src/styles/dense-mode.css`
- Modify: `src/app/globals.css`

**Step 1: Create dense mode styles**

```css
/* src/styles/dense-mode.css */

/* Dense mode utilities - apply to parent container */
.dense-mode {
  /* Reduce all spacing by ~40% */
  --spacing-scale: 0.6;
}

/* Dense table cells */
.dense-mode table td,
.dense-mode table th {
  @apply px-2 py-1.5 text-sm;
}

/* Dense cards */
.dense-mode .card-content {
  @apply p-3;
}

.dense-mode .card-header {
  @apply p-3 pb-0;
}

/* Dense list items */
.dense-mode .list-item {
  @apply px-2 py-1;
}

/* Dense buttons */
.dense-mode .btn-dense {
  @apply px-2 py-1 text-sm;
}

/* Dense form inputs */
.dense-mode input,
.dense-mode select,
.dense-mode textarea {
  @apply py-1.5 text-sm;
}

/* Dense sidebar navigation */
.dense-mode .nav-item {
  @apply px-2 py-1.5 text-sm;
}

/* Dense gaps */
.dense-mode .gap-standard {
  @apply gap-2;
}

/* Utility classes for conditional dense styling */
.dense\:p-2 {
  /* Will apply p-2 when .dense-mode parent is present */
}

@layer utilities {
  /* Dense variants using group */
  .group-dense .group-dense\:p-2 {
    @apply p-2;
  }

  .group-dense .group-dense\:gap-2 {
    @apply gap-2;
  }

  .group-dense .group-dense\:text-sm {
    @apply text-sm;
  }
}
```

**Step 2: Import in globals.css**

Add to `src/app/globals.css` after other imports:

```css
@import "../styles/dense-mode.css";
```

**Step 3: Commit**

```bash
git add src/styles/ src/app/globals.css
git commit -m "feat(guidance): add dense mode CSS utilities"
```

---

## Task 3.6: Add Keyboard Shortcut for Level Toggle

**Files:**

- Modify: `src/components/ui/command-palette/useCommandPalette.ts`
- Modify: `src/lib/search-index.ts` (if exists)

**Step 1: Add shortcut handler**

In `useCommandPalette.ts`, add shortcut for toggling guidance level:

Find the keyboard event handler and add:

```typescript
// ⌘G / Ctrl+G to cycle guidance level
if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
  e.preventDefault()
  // Emit custom event for guidance toggle
  window.dispatchEvent(new CustomEvent("toggle-guidance-level"))
  return
}
```

**Step 2: Listen for event in QuickLevelToggle**

Add to QuickLevelToggle.tsx:

```typescript
useEffect(() => {
  const handleToggle = () => {
    const levels = Object.values(COMPETENCE_LEVELS) as CompetenceLevel[]
    const currentIndex = levels.indexOf(currentLevel)
    const nextIndex = (currentIndex + 1) % levels.length
    handleSetLevel(levels[nextIndex])
  }

  window.addEventListener("toggle-guidance-level", handleToggle)
  return () => window.removeEventListener("toggle-guidance-level", handleToggle)
}, [currentLevel])
```

**Step 3: Commit**

```bash
git add src/components/
git commit -m "feat(guidance): add Cmd+G shortcut for cycling guidance level"
```

---

## Task 3.7: Build Verification and Push

**Step 1: Run tests**

```bash
node --import tsx --test src/lib/guidance/__tests__/*.test.ts
```

**Step 2: Run build**

```bash
npm run build
```

**Step 3: Commit and push**

```bash
git add .
git commit -m "feat(guidance): complete Phase 3 - Mode Differentiation"
git push origin main
```

---

## Quick Reference

**New files created:**

- `src/contexts/GuidanceContext.tsx` - Global guidance state
- `src/contexts/index.ts` - Context exports
- `src/components/guidance/HelpTooltip.tsx` - Contextual help tooltips
- `src/components/guidance/QuickLevelToggle.tsx` - Fast level switching
- `src/styles/dense-mode.css` - Dense UI utilities

**Modified files:**

- `src/components/layout/header.tsx` - Added QuickLevelToggle
- `src/components/guidance/index.ts` - New exports
- `src/app/globals.css` - Import dense mode styles
- `src/components/ui/command-palette/useCommandPalette.ts` - Keyboard shortcut

**Keyboard shortcuts:**

- `Cmd+G` / `Ctrl+G` - Cycle guidance level (beginner → average → pro)
- `Cmd+K` / `Ctrl+K` - Command palette (existing)
