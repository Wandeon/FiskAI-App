# Phase 5: ESLint Enforcement

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create custom ESLint rule to block hardcoded colors with path-scoped enforcement.

**Architecture:** Custom ESLint plugin with escape hatch support. Strict in app/admin/staff, warnings in marketing.

**Tech Stack:** ESLint, TypeScript

---

## Task 1: Create ESLint Plugin Structure

**Files:**

- Create: `src/design-system/eslint/index.js`

**Step 1: Create plugin index**

```javascript
/**
 * FiskAI Design System ESLint Plugin
 *
 * Enforces design token usage, blocks hardcoded colors.
 */

const noHardcodedColors = require("./no-hardcoded-colors")

module.exports = {
  rules: {
    "no-hardcoded-colors": noHardcodedColors,
  },
  configs: {
    strict: {
      plugins: ["fisk-design-system"],
      rules: {
        "fisk-design-system/no-hardcoded-colors": "error",
      },
    },
    recommended: {
      plugins: ["fisk-design-system"],
      rules: {
        "fisk-design-system/no-hardcoded-colors": "warn",
      },
    },
  },
}
```

---

## Task 2: Create No-Hardcoded-Colors Rule

**Files:**

- Create: `src/design-system/eslint/no-hardcoded-colors.js`

**Step 1: Create the rule**

```javascript
/**
 * ESLint Rule: no-hardcoded-colors
 *
 * Blocks hardcoded color values in favor of design tokens.
 * Supports @design-override comment for escape hatch.
 */

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow hardcoded color values; use design tokens",
      category: "Design System",
      recommended: true,
    },
    messages: {
      noHexColor:
        'Hardcoded color "{{color}}" detected. Use design tokens. Add "// @design-override: reason" to bypass.',
      noRgbColor:
        "Hardcoded RGB/RGBA color detected. Use design tokens or add @design-override comment.",
      noRawTailwindColor:
        'Raw Tailwind color class "{{cls}}" detected. Use semantic tokens (e.g., text-foreground, bg-surface).',
      noArbitraryColor: 'Arbitrary Tailwind color "{{value}}" detected. Use design tokens.',
    },
    schema: [],
  },

  create(context) {
    const sourceCode = context.getSourceCode()

    // Blocked Tailwind color patterns
    const blockedPatterns = [
      // Standard color classes
      /^(bg|text|border|ring|shadow|outline|from|to|via|fill|stroke|decoration|accent|caret|divide|placeholder)-(red|blue|green|yellow|gray|slate|amber|emerald|cyan|purple|pink|orange|indigo|violet|rose|lime|teal|sky|fuchsia|stone|zinc|neutral)-\d+/,
      // With opacity modifier
      /^(bg|text|border|ring)-(red|blue|green|yellow|gray|slate|amber|emerald|cyan|purple|pink|orange|indigo|violet|rose|lime|teal|sky|fuchsia|stone|zinc|neutral)-\d+\/\d+/,
    ]

    // Check if line has override comment
    function hasOverrideComment(node) {
      const comments = sourceCode.getCommentsBefore(node)
      const lineComments = sourceCode.getCommentsAfter(node)
      const allComments = [...comments, ...lineComments]

      // Also check same-line comments
      const token = sourceCode.getTokenBefore(node)
      if (token) {
        const tokenComments = sourceCode.getCommentsAfter(token)
        allComments.push(...tokenComments)
      }

      return allComments.some(
        (c) => c.value.includes("@design-override:") || c.value.includes("design-system-ignore")
      )
    }

    // Check parent chain for override
    function hasParentOverride(node) {
      let current = node
      while (current) {
        if (hasOverrideComment(current)) return true
        current = current.parent
      }
      return false
    }

    return {
      // Block hex colors in style objects and strings
      Literal(node) {
        if (hasParentOverride(node)) return

        if (typeof node.value === "string") {
          const val = node.value

          // Check for hex colors
          if (/^#[0-9a-fA-F]{3,8}$/.test(val)) {
            // Allow white/black
            if (["#fff", "#ffffff", "#000", "#000000"].includes(val.toLowerCase())) {
              return
            }
            context.report({
              node,
              messageId: "noHexColor",
              data: { color: val },
            })
          }

          // Check for rgb/rgba
          if (/^rgba?\s*\(/.test(val)) {
            context.report({
              node,
              messageId: "noRgbColor",
            })
          }

          // Check for arbitrary Tailwind values [#...]
          if (/\[#[0-9a-fA-F]+\]/.test(val)) {
            context.report({
              node,
              messageId: "noArbitraryColor",
              data: { value: val },
            })
          }
        }
      },

      // Block raw Tailwind color classes in className
      JSXAttribute(node) {
        if (node.name.name !== "className") return
        if (hasParentOverride(node)) return

        const value = node.value
        if (!value) return

        let classString = ""

        // Handle different className value types
        if (value.type === "Literal" && typeof value.value === "string") {
          classString = value.value
        } else if (value.type === "JSXExpressionContainer") {
          // Handle template literals
          if (value.expression.type === "TemplateLiteral") {
            classString = value.expression.quasis.map((q) => q.value.raw).join(" ")
          }
          // Handle cn(), clsx(), etc. with string arguments
          if (value.expression.type === "CallExpression" && value.expression.arguments) {
            value.expression.arguments.forEach((arg) => {
              if (arg.type === "Literal" && typeof arg.value === "string") {
                classString += " " + arg.value
              }
            })
          }
        }

        const classes = classString.split(/\s+/).filter(Boolean)

        for (const cls of classes) {
          if (blockedPatterns.some((p) => p.test(cls))) {
            context.report({
              node,
              messageId: "noRawTailwindColor",
              data: { cls },
            })
          }
        }
      },

      // Block hex/rgb in style prop objects
      Property(node) {
        if (hasParentOverride(node)) return

        // Check if this is inside a style object
        const isStyleProp =
          node.parent?.parent?.type === "JSXAttribute" &&
          node.parent?.parent?.name?.name === "style"

        if (!isStyleProp) return

        if (node.value?.type === "Literal" && typeof node.value.value === "string") {
          const val = node.value.value

          if (/^#[0-9a-fA-F]{3,8}$/.test(val)) {
            if (!["#fff", "#ffffff", "#000", "#000000"].includes(val.toLowerCase())) {
              context.report({
                node,
                messageId: "noHexColor",
                data: { color: val },
              })
            }
          }

          if (/^rgba?\s*\(/.test(val)) {
            context.report({
              node,
              messageId: "noRgbColor",
            })
          }
        }
      },
    }
  },
}
```

---

## Task 3: Update ESLint Config

**Files:**

- Modify: `.eslintrc.json` or `eslint.config.js`

**Step 1: Check current ESLint config format**

```bash
ls -la .eslintrc* eslint.config.* 2>/dev/null
cat .eslintrc.json 2>/dev/null | head -20 || cat eslint.config.js 2>/dev/null | head -20
```

**Step 2: Add plugin to .eslintrc.json (if using JSON format)**

Add to the config:

```json
{
  "plugins": ["fisk-design-system"],
  "overrides": [
    {
      "files": [
        "src/app/(app)/**/*",
        "src/app/(admin)/**/*",
        "src/app/(staff)/**/*",
        "src/components/**/*"
      ],
      "rules": {
        "fisk-design-system/no-hardcoded-colors": "error"
      }
    },
    {
      "files": ["src/app/(marketing)/**/*"],
      "rules": {
        "fisk-design-system/no-hardcoded-colors": "warn"
      }
    }
  ]
}
```

**Step 3: Create eslint plugin link**

```bash
# Create symlink so ESLint can find the plugin
mkdir -p node_modules/eslint-plugin-fisk-design-system
ln -sf ../../../src/design-system/eslint/index.js node_modules/eslint-plugin-fisk-design-system/index.js
```

---

## Task 4: Test ESLint Rule

**Step 1: Create test file with violations**

```bash
cat > /tmp/test-violations.tsx << 'EOF'
// This file should trigger ESLint errors

export function BadComponent() {
  return (
    <div className="text-blue-600 bg-red-500">
      <span style={{ color: '#3b82f6' }}>Hardcoded hex</span>
      <span className="border-gray-200">Raw Tailwind</span>
    </div>
  );
}
EOF
```

**Step 2: Run ESLint on test file**

```bash
npx eslint /tmp/test-violations.tsx --rule 'fisk-design-system/no-hardcoded-colors: error' 2>&1
```

Expected: Multiple errors reported

**Step 3: Test escape hatch**

```bash
cat > /tmp/test-override.tsx << 'EOF'
export function OverrideComponent() {
  return (
    // @design-override: Brand partner requirement
    <div className="text-blue-600">
      This should NOT trigger an error
    </div>
  );
}
EOF

npx eslint /tmp/test-override.tsx --rule 'fisk-design-system/no-hardcoded-colors: error' 2>&1
```

Expected: No errors (escape hatch works)

**Step 4: Clean up**

```bash
rm /tmp/test-violations.tsx /tmp/test-override.tsx
```

---

## Task 5: Commit Phase 5

**Step 1: Commit changes**

```bash
git add src/design-system/eslint/
git add .eslintrc.json eslint.config.js 2>/dev/null || true
git commit -m "feat(design-system): add ESLint enforcement (phase 5)

- Create fisk-design-system ESLint plugin
- Add no-hardcoded-colors rule
- Block hex colors, RGB values, raw Tailwind color classes
- Path-scoped: ERROR in app/admin/staff, WARN in marketing
- Support @design-override escape hatch with required reason"
```

---

## Verification Checklist

- [ ] `src/design-system/eslint/index.js` exists
- [ ] `src/design-system/eslint/no-hardcoded-colors.js` exists
- [ ] Plugin symlink created in node_modules
- [ ] ESLint config updated with overrides
- [ ] Rule catches hex colors
- [ ] Rule catches RGB/RGBA colors
- [ ] Rule catches raw Tailwind colors (text-blue-600)
- [ ] Rule catches arbitrary values ([#...])
- [ ] Escape hatch (@design-override) works
- [ ] Commit created
