# Phase 8-9: Pre-commit Hook & Governance

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up pre-commit hook to enforce design tokens and create governance documentation.

**Architecture:** Husky pre-commit hook runs ESLint on staged files. TOKENS.md documents ownership and processes.

**Tech Stack:** Husky, lint-staged

---

## Task 1: Install Husky (if not present)

**Step 1: Check if Husky is installed**

```bash
ls -la .husky/ 2>/dev/null && echo "Husky installed" || echo "Husky not installed"
cat package.json | grep husky
```

**Step 2: Install Husky if needed**

```bash
npm install --save-dev husky lint-staged
npx husky init
```

---

## Task 2: Create Pre-commit Hook

**Files:**

- Create/Modify: `.husky/pre-commit`

**Step 1: Create pre-commit hook**

```bash
cat > .husky/pre-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run lint-staged for design system enforcement
npx lint-staged
EOF

chmod +x .husky/pre-commit
```

---

## Task 3: Configure lint-staged

**Files:**

- Modify: `package.json`

**Step 1: Add lint-staged config to package.json**

Add to package.json:

```json
{
  "lint-staged": {
    "src/app/(app)/**/*.{ts,tsx}": [
      "eslint --rule 'fisk-design-system/no-hardcoded-colors: error' --max-warnings 0"
    ],
    "src/app/(admin)/**/*.{ts,tsx}": [
      "eslint --rule 'fisk-design-system/no-hardcoded-colors: error' --max-warnings 0"
    ],
    "src/app/(staff)/**/*.{ts,tsx}": [
      "eslint --rule 'fisk-design-system/no-hardcoded-colors: error' --max-warnings 0"
    ],
    "src/components/**/*.{ts,tsx}": [
      "eslint --rule 'fisk-design-system/no-hardcoded-colors: error' --max-warnings 0"
    ],
    "src/app/(marketing)/**/*.{ts,tsx}": [
      "eslint --rule 'fisk-design-system/no-hardcoded-colors: warn'"
    ]
  }
}
```

---

## Task 4: Test Pre-commit Hook

**Step 1: Create test file with violation**

```bash
cat > src/components/ui/test-violation.tsx << 'EOF'
export function TestViolation() {
  return <div className="text-blue-600">This should fail</div>;
}
EOF
```

**Step 2: Stage and attempt commit**

```bash
git add src/components/ui/test-violation.tsx
git commit -m "test: should fail" 2>&1 | head -20
```

Expected: Commit should fail with ESLint error

**Step 3: Clean up**

```bash
git reset HEAD src/components/ui/test-violation.tsx
rm src/components/ui/test-violation.tsx
```

---

## Task 5: Create TOKENS.md Governance Document

**Files:**

- Create: `src/design-system/TOKENS.md`

**Step 1: Create TOKENS.md**

```markdown
# FiskAI Design Tokens - Governance

This document defines the rules for managing design tokens in the FiskAI codebase.

## Ownership

**Token Owner:** Frontend Team Lead
**Review Required:** Any PR adding/modifying tokens needs design system owner approval

## Token Architecture
```

LAYER 0: PRIMITIVES (primitives.ts)
└── Raw color values - NEVER import directly in components

LAYER 1: SEMANTIC (semantic/\*.ts)
├── surfaces.ts - Surface ladder
├── text.ts - Text hierarchy
├── borders.ts - Border tokens
├── interactive.ts - Interactive states
└── colors.ts - Status colors

LAYER 2: LAYOUT (layout/\*.ts)
├── spacing.ts - 4px base spacing
├── radius.ts - Border radius
└── elevation.ts - Shadows & z-index

LAYER 3: SPECIALIZED
├── typography.ts - Text styles
├── motion.ts - Animation
└── data-vis.ts - Chart colors

````

## Adding New Tokens

### Requirements

1. **Rationale:** Why can't existing tokens solve this?
2. **Usage Examples:** Show 3+ real use cases
3. **Dark Mode:** All color tokens need light + dark variants
4. **PR Description:** Must include token purpose and examples

### Process

1. Create PR with new token(s)
2. Add rationale in PR description
3. Request review from token owner
4. Merge after approval

### Token Naming Rules

| Type | Pattern | Example |
|------|---------|---------|
| Surface | `surface{level}` | `surface0`, `surface1` |
| Text | `{purpose}` | `primary`, `secondary`, `link` |
| Interactive | `{variant}{State}` | `primaryHover`, `dangerHover` |
| Status | `{status}{property}` | `successBg`, `dangerText` |
| Spacing | Number (4px units) | `4` = 16px, `6` = 24px |
| Chart | `series{n}` | `series1`, `series2` |

## Modifying Tokens

### Safe Changes (Minor Version)

- Adding new tokens
- Adding new variants to existing tokens
- Documentation updates

### Breaking Changes (Major Version)

- Removing tokens
- Renaming tokens
- Changing token values significantly

### Process for Breaking Changes

1. Add deprecation warning in JSDoc
2. Create migration guide
3. Allow 2 sprint transition period
4. Remove in next major version

## Escape Hatch Usage

Use `// @design-override: <reason>` ONLY when:

**Acceptable:**
- Third-party component requires specific color
- Brand partner requirement with specific hex
- One-off marketing campaign with approval
- Canvas/SVG rendering that can't use CSS variables

**NOT Acceptable:**
- "It looks better this way"
- "Faster than finding the right token"
- "I don't know which token to use"

### Escape Hatch Format

```tsx
// @design-override: Brand partner XYZ requires exact hex #AB1234
<div className="bg-[#AB1234]">Partner Logo</div>
````

## Enforcement

### ESLint Rules

| Path                     | Level | Rule                        |
| ------------------------ | ----- | --------------------------- |
| `src/app/(app)/**`       | ERROR | Block hardcoded colors      |
| `src/app/(admin)/**`     | ERROR | Block hardcoded colors      |
| `src/app/(staff)/**`     | ERROR | Block hardcoded colors      |
| `src/components/**`      | ERROR | Block hardcoded colors      |
| `src/app/(marketing)/**` | WARN  | Warn about hardcoded colors |

### Pre-commit Hook

Commits are blocked if:

- Hardcoded colors in app/admin/staff/components
- No escape hatch comment provided

### CI Pipeline

ESLint runs in CI with same rules as pre-commit.

## Common Questions

### Q: Which token should I use for X?

Check the token files in order:

1. `semantic/` - Most UI needs are here
2. `layout/` - Spacing, radius, shadows
3. `typography.ts` - Text styles
4. `data-vis.ts` - Chart colors only

### Q: What if I need a color that doesn't exist?

1. Check if existing token can work (often it can)
2. If truly new need, propose new token via PR
3. Use escape hatch temporarily if blocking

### Q: How do I handle third-party components?

Use escape hatch with comment explaining the third-party requirement.

### Q: Dark mode isn't working?

Ensure you're using CSS variable-based tokens (`var(--surface-0)`), not direct hex values.

## Resources

- [Design System Architecture](../docs/plans/2025-12-27-design-system-architecture.md)
- [Tailwind Config](../../tailwind.config.ts)
- [CSS Variables](./css/variables.css)

````

---

## Task 6: Create README for Design System

**Files:**
- Create: `src/design-system/README.md`

**Step 1: Create README.md**

```markdown
# FiskAI Design System

A self-enforcing design system with tokenized colors, typography, spacing, and motion.

## Quick Start

```tsx
// Import types for type-safe props
import type { ButtonVariant, StatusVariant } from '@/design-system';

// Use semantic Tailwind classes
<div className="bg-surface text-foreground border-border">
  <h1 className="text-heading-xl">Title</h1>
  <p className="text-body-base text-secondary">Description</p>
  <Button variant="primary">Action</Button>
  <Badge variant="success">Status</Badge>
</div>
````

## Available Classes

### Surfaces

- `bg-base` - Page background
- `bg-surface` - Cards (default)
- `bg-surface-1` - Nested cards, hover states
- `bg-surface-2` - Deeper nesting
- `bg-surface-elevated` - Modals

### Text

- `text-foreground` - Primary text
- `text-secondary` - Body text
- `text-tertiary` - Captions
- `text-muted` - Disabled
- `text-link` - Links

### Status

- `bg-success-bg`, `text-success-text`, `border-success-border`
- `bg-warning-bg`, `text-warning-text`, `border-warning-border`
- `bg-danger-bg`, `text-danger-text`, `border-danger-border`
- `bg-info-bg`, `text-info-text`, `border-info-border`

### Typography

- `text-display-xl`, `text-display-lg`, `text-display-md`
- `text-heading-xl`, `text-heading-lg`, `text-heading-md`, `text-heading-sm`
- `text-body-lg`, `text-body-base`, `text-body-sm`, `text-body-xs`
- `text-label`, `text-caption`, `text-overline`, `text-code`

### Interactive

- `bg-interactive`, `hover:bg-interactive-hover`
- `border-border-focus`

### Charts

- `text-chart-1` through `text-chart-8`

## Enforcement

Hardcoded colors are blocked by ESLint:

```tsx
// ❌ BLOCKED
<div className="text-blue-600">Error!</div>

// ✅ ALLOWED
<div className="text-link">Correct!</div>
```

### Escape Hatch

```tsx
// @design-override: Partner brand requirement
<div className="bg-[#AB1234]">Partner content</div>
```

## Documentation

- [Architecture](../docs/plans/2025-12-27-design-system-architecture.md)
- [Governance](./TOKENS.md)

````

---

## Task 7: Commit Phase 8-9

**Step 1: Commit changes**

```bash
git add .husky/pre-commit
git add package.json
git add src/design-system/TOKENS.md
git add src/design-system/README.md
git commit -m "feat(design-system): add pre-commit hook and governance (phase 8-9)

- Add Husky pre-commit hook for design system enforcement
- Configure lint-staged for path-scoped linting
- Create TOKENS.md governance document
- Create README.md for design system usage
- Document token ownership, naming rules, escape hatch policy"
````

---

## Task 8: Final Verification

**Step 1: Run full lint check**

```bash
npx eslint src/components/ui/ --rule 'fisk-design-system/no-hardcoded-colors: error' 2>&1 | head -30
```

**Step 2: Test pre-commit hook works**

```bash
# Make a small valid change
echo "// test" >> src/design-system/README.md
git add src/design-system/README.md
git commit -m "test: verify pre-commit hook"
git reset --soft HEAD~1
git checkout src/design-system/README.md
```

**Step 3: Verify all files exist**

```bash
ls -la src/design-system/
ls -la src/design-system/tokens/
ls -la src/design-system/tokens/semantic/
ls -la src/design-system/tokens/layout/
ls -la src/design-system/eslint/
ls -la src/design-system/css/
```

---

## Verification Checklist

- [ ] Husky installed and configured
- [ ] Pre-commit hook exists and is executable
- [ ] lint-staged config in package.json
- [ ] Pre-commit hook blocks violations
- [ ] TOKENS.md governance document created
- [ ] README.md usage guide created
- [ ] All commits made
- [ ] Full ESLint check passes on components
