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
