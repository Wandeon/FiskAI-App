# FiskAI Design Tokens - Governance

This document defines the rules for managing design tokens in the FiskAI codebase.

## Ownership

**Token Owner:** Frontend Team Lead
**Review Required:** Any PR adding/modifying tokens needs design system owner approval

## Token Architecture

```
LAYER 0: PRIMITIVES (primitives.ts)
└── Raw color values - NEVER import directly in components

LAYER 1: SEMANTIC (semantic/*.ts)
├── surfaces.ts  - Surface ladder
├── text.ts      - Text hierarchy
├── borders.ts   - Border tokens
├── interactive.ts - Interactive states
└── colors.ts    - Status colors

LAYER 2: LAYOUT (layout/*.ts)
├── spacing.ts   - 4px base spacing
├── radius.ts    - Border radius
└── elevation.ts - Shadows & z-index

LAYER 3: SPECIALIZED
├── typography.ts - Text styles
├── motion.ts     - Animation
└── data-vis.ts   - Chart colors
```

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

| Type        | Pattern              | Example                        |
| ----------- | -------------------- | ------------------------------ |
| Surface     | `surface{level}`     | `surface0`, `surface1`         |
| Text        | `{purpose}`          | `primary`, `secondary`, `link` |
| Interactive | `{variant}{State}`   | `primaryHover`, `dangerHover`  |
| Status      | `{status}{property}` | `successBg`, `dangerText`      |
| Spacing     | Number (4px units)   | `4` = 16px, `6` = 24px         |
| Chart       | `series{n}`          | `series1`, `series2`           |

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
```

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

- [Design System Architecture](../../docs/plans/2025-12-27-design-system-architecture.md)
- [Tailwind Config](../../tailwind.config.ts)
- [CSS Variables](./css/variables.css)
