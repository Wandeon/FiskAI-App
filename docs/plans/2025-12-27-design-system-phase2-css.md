# Phase 2: CSS Variables

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create CSS custom properties from tokens so Tailwind and components can use them.

**Architecture:** Generate CSS variables for all semantic tokens, supporting light/dark themes.

**Tech Stack:** CSS Custom Properties, PostCSS

---

## Task 1: Create CSS Variables File

**Files:**

- Create: `src/design-system/css/variables.css`

**Step 1: Create variables.css**

```css
/**
 * DESIGN SYSTEM CSS VARIABLES
 *
 * Generated from design tokens.
 * These power the Tailwind config and can be used directly.
 */

:root {
  /* ═══════════════════════════════════════════════════════════════
     SURFACE TOKENS - Light mode default
     ═══════════════════════════════════════════════════════════════ */
  --surface-base: #f8fafc;
  --surface-0: #ffffff;
  --surface-1: #f1f5f9;
  --surface-2: #e2e8f0;
  --surface-elevated: #ffffff;
  --overlay: rgba(15, 23, 42, 0.4);

  /* ═══════════════════════════════════════════════════════════════
     TEXT TOKENS
     ═══════════════════════════════════════════════════════════════ */
  --text-primary: #0f172a;
  --text-secondary: #334155;
  --text-tertiary: #475569;
  --text-disabled: #94a3b8;
  --text-inverse: #ffffff;
  --text-link: #2563eb;

  /* ═══════════════════════════════════════════════════════════════
     BORDER TOKENS
     ═══════════════════════════════════════════════════════════════ */
  --border-default: #cbd5e1;
  --border-subtle: #e2e8f0;
  --border-strong: #94a3b8;
  --border-focus: #3b82f6;

  /* ═══════════════════════════════════════════════════════════════
     INTERACTIVE TOKENS
     ═══════════════════════════════════════════════════════════════ */
  --interactive-primary: #2563eb;
  --interactive-primary-hover: #1d4ed8;
  --interactive-secondary: #ffffff;
  --interactive-secondary-hover: #f1f5f9;
  --interactive-danger: #dc2626;
  --interactive-danger-hover: #b91c1c;
  --interactive-ghost: transparent;
  --interactive-ghost-hover: #e2e8f0;

  /* ═══════════════════════════════════════════════════════════════
     STATUS TOKENS - Success
     ═══════════════════════════════════════════════════════════════ */
  --success: #059669;
  --success-bg: #ecfdf5;
  --success-text: #047857;
  --success-border: #a7f3d0;
  --success-icon: #059669;

  /* ═══════════════════════════════════════════════════════════════
     STATUS TOKENS - Warning
     ═══════════════════════════════════════════════════════════════ */
  --warning: #d97706;
  --warning-bg: #fffbeb;
  --warning-text: #b45309;
  --warning-border: #fde68a;
  --warning-icon: #d97706;

  /* ═══════════════════════════════════════════════════════════════
     STATUS TOKENS - Danger
     ═══════════════════════════════════════════════════════════════ */
  --danger: #dc2626;
  --danger-bg: #fef2f2;
  --danger-text: #b91c1c;
  --danger-border: #fecaca;
  --danger-icon: #dc2626;

  /* ═══════════════════════════════════════════════════════════════
     STATUS TOKENS - Info
     ═══════════════════════════════════════════════════════════════ */
  --info: #2563eb;
  --info-bg: #eff6ff;
  --info-text: #1d4ed8;
  --info-border: #bfdbfe;
  --info-icon: #2563eb;

  /* ═══════════════════════════════════════════════════════════════
     ELEVATION TOKENS
     ═══════════════════════════════════════════════════════════════ */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  --shadow-focus: 0 0 0 3px rgba(59, 130, 246, 0.3);
  --shadow-card: 0 10px 30px rgba(15, 23, 42, 0.08);
  --shadow-card-hover: 0 25px 50px rgba(15, 23, 42, 0.12);

  /* ═══════════════════════════════════════════════════════════════
     ACCENT (Marketing)
     ═══════════════════════════════════════════════════════════════ */
  --accent: #06b6d4;
  --accent-light: #22d3ee;
  --accent-dark: #0891b2;

  /* ═══════════════════════════════════════════════════════════════
     DATA VISUALIZATION
     ═══════════════════════════════════════════════════════════════ */
  --chart-series-1: #6366f1;
  --chart-series-2: #8b5cf6;
  --chart-series-3: #ec4899;
  --chart-series-4: #14b8a6;
  --chart-series-5: #f97316;
  --chart-series-6: #84cc16;
  --chart-series-7: #06b6d4;
  --chart-series-8: #f43f5e;
  --chart-grid: rgba(148, 163, 184, 0.2);
  --chart-axis: #64748b;

  /* ═══════════════════════════════════════════════════════════════
     MOTION
     ═══════════════════════════════════════════════════════════════ */
  --duration-instant: 0ms;
  --duration-fast: 100ms;
  --duration-normal: 150ms;
  --duration-slow: 200ms;
  --duration-slower: 300ms;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* ═══════════════════════════════════════════════════════════════
   DARK MODE
   ═══════════════════════════════════════════════════════════════ */
.dark {
  /* Surfaces */
  --surface-base: #020617;
  --surface-0: #0f172a;
  --surface-1: #1e293b;
  --surface-2: #334155;
  --surface-elevated: #1e293b;
  --overlay: rgba(0, 0, 0, 0.6);

  /* Text */
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-tertiary: #64748b;
  --text-disabled: #475569;
  --text-inverse: #0f172a;
  --text-link: #60a5fa;

  /* Borders */
  --border-default: #334155;
  --border-subtle: #1e293b;
  --border-strong: #475569;
  --border-focus: #60a5fa;

  /* Interactive */
  --interactive-primary: #3b82f6;
  --interactive-primary-hover: #60a5fa;
  --interactive-secondary: #1e293b;
  --interactive-secondary-hover: #334155;
  --interactive-danger: #dc2626;
  --interactive-danger-hover: #ef4444;
  --interactive-ghost: transparent;
  --interactive-ghost-hover: #1e293b;

  /* Status - Success */
  --success: #10b981;
  --success-bg: rgba(16, 185, 129, 0.1);
  --success-text: #34d399;
  --success-border: #065f46;
  --success-icon: #10b981;

  /* Status - Warning */
  --warning: #f59e0b;
  --warning-bg: rgba(245, 158, 11, 0.1);
  --warning-text: #fbbf24;
  --warning-border: #92400e;
  --warning-icon: #f59e0b;

  /* Status - Danger */
  --danger: #ef4444;
  --danger-bg: rgba(239, 68, 68, 0.1);
  --danger-text: #f87171;
  --danger-border: #991b1b;
  --danger-icon: #ef4444;

  /* Status - Info */
  --info: #3b82f6;
  --info-bg: rgba(59, 130, 246, 0.1);
  --info-text: #60a5fa;
  --info-border: #1e40af;
  --info-icon: #3b82f6;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
  --shadow-focus: 0 0 0 3px rgba(96, 165, 250, 0.3);
  --shadow-card: 0 10px 30px rgba(0, 0, 0, 0.3);
  --shadow-card-hover: 0 25px 50px rgba(0, 0, 0, 0.4);

  /* Accent */
  --accent: #22d3ee;
  --accent-light: #67e8f9;
  --accent-dark: #06b6d4;
}

/* ═══════════════════════════════════════════════════════════════
   REDUCED MOTION
   ═══════════════════════════════════════════════════════════════ */
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

---

## Task 2: Update globals.css to Import Variables

**Files:**

- Modify: `src/app/globals.css`

**Step 1: Add import at top of globals.css**

Add this line at the very top of the file (before @tailwind directives):

```css
@import "../design-system/css/variables.css";
```

**Step 2: Verify import works**

```bash
npm run dev &
sleep 5
curl -s http://localhost:3000 | head -20
kill %1
```

Expected: Page loads without CSS errors

---

## Task 3: Commit Phase 2

**Step 1: Commit changes**

```bash
git add src/design-system/css/variables.css
git add src/app/globals.css
git commit -m "feat(design-system): add CSS variables (phase 2)

- Create variables.css with all semantic CSS custom properties
- Support light/dark mode via .dark class
- Add reduced motion support
- Import variables in globals.css"
```

---

## Verification Checklist

- [ ] `src/design-system/css/variables.css` exists
- [ ] All semantic tokens have corresponding CSS variables
- [ ] Dark mode overrides are complete
- [ ] Reduced motion media query is present
- [ ] globals.css imports the variables file
- [ ] Dev server starts without errors
- [ ] Commit created
