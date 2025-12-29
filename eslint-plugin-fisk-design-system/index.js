/**
 * ESLint Plugin: Fisk Design System
 *
 * Enforces semantic color token usage and prevents hardcoded Tailwind colors.
 */

module.exports = {
  rules: {
    'no-hardcoded-colors': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Prevent hardcoded Tailwind color usage in favor of semantic design tokens',
          category: 'Design System',
          recommended: true,
        },
        fixable: 'code',
        schema: [],
        messages: {
          hardcodedColor:
            'Avoid hardcoded color "{{color}}". Use semantic tokens instead: {{suggestion}}',
        },
      },
      create(context) {
        // Hardcoded color patterns to detect
        const hardcodedColorPatterns = [
          // Tailwind color patterns: text-blue-500, bg-slate-800, border-red-600
          /\b(text|bg|border|ring|from|to|via|decoration|divide|outline|shadow|fill|stroke|caret|accent|placeholder)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(\d{1,3}|950)\b/,
          // RGB/RGBA colors in className
          /rgb\(/,
          /rgba\(/,
          // Hex colors in className
          /#[0-9a-fA-F]{3,8}/,
        ];

        // Semantic token suggestions based on hardcoded colors
        const colorSuggestions = {
          // Text colors
          'text-slate-800': 'text-foreground',
          'text-slate-900': 'text-foreground',
          'text-slate-700': 'text-foreground',
          'text-slate-600': 'text-secondary',
          'text-slate-500': 'text-tertiary',
          'text-slate-400': 'text-muted',
          'text-white': 'text-inverse (or text-white if truly needed)',

          // Background colors
          'bg-white': 'bg-surface',
          'bg-slate-50': 'bg-surface-1',
          'bg-slate-100': 'bg-surface-2',
          'bg-slate-800': 'bg-surface-1 (in dark mode context)',
          'bg-slate-900': 'bg-surface (in dark mode context)',

          // Border colors
          'border-slate-200': 'border-default',
          'border-slate-300': 'border-default',
          'border-slate-100': 'border-subtle',
          'border-slate-400': 'border-strong',

          // Interactive colors
          'bg-blue-600': 'bg-interactive',
          'bg-blue-500': 'bg-interactive',
          'text-blue-600': 'text-link or text-interactive',
          'border-blue-500': 'border-focus',
          'hover:bg-blue-700': 'hover:bg-interactive-hover',

          // Status colors
          'bg-emerald-50': 'bg-success-bg',
          'text-emerald-700': 'text-success-text',
          'border-emerald-500': 'border-success-border',
          'bg-amber-50': 'bg-warning-bg',
          'text-amber-700': 'text-warning-text',
          'border-amber-500': 'border-warning-border',
          'bg-red-50': 'bg-danger-bg',
          'text-red-700': 'text-danger-text',
          'border-red-500': 'border-danger-border',
          'bg-blue-50': 'bg-info-bg',
          'text-blue-700': 'text-info-text',
          'border-blue-500': 'border-info-border',
        };

        function checkForHardcodedColors(node, value) {
          if (typeof value !== 'string') return;

          for (const pattern of hardcodedColorPatterns) {
            const matches = value.match(pattern);
            if (matches) {
              const hardcodedColor = matches[0];

              // Get suggestion or provide generic guidance
              let suggestion = colorSuggestions[hardcodedColor];

              if (!suggestion) {
                // Provide category-based suggestions
                if (hardcodedColor.startsWith('text-')) {
                  suggestion = 'text-foreground, text-secondary, text-tertiary, or text-muted';
                } else if (hardcodedColor.startsWith('bg-')) {
                  suggestion = 'bg-surface, bg-surface-1, bg-surface-2, or status colors (bg-success-bg, etc.)';
                } else if (hardcodedColor.startsWith('border-')) {
                  suggestion = 'border-default, border-subtle, border-strong, or border-focus';
                } else {
                  suggestion = 'Check design-system/css/variables.css for available semantic tokens';
                }
              }

              context.report({
                node,
                messageId: 'hardcodedColor',
                data: {
                  color: hardcodedColor,
                  suggestion,
                },
              });
            }
          }
        }

        return {
          // Check JSX className attributes
          JSXAttribute(node) {
            if (
              node.name &&
              node.name.name === 'className' &&
              node.value
            ) {
              if (node.value.type === 'Literal') {
                checkForHardcodedColors(node, node.value.value);
              } else if (
                node.value.type === 'JSXExpressionContainer' &&
                node.value.expression
              ) {
                // Check template literals and string concatenations
                const expr = node.value.expression;
                if (expr.type === 'TemplateLiteral') {
                  expr.quasis.forEach((quasi) => {
                    checkForHardcodedColors(node, quasi.value.raw);
                  });
                } else if (expr.type === 'Literal') {
                  checkForHardcodedColors(node, expr.value);
                }
              }
            }
          },

          // Check cn() and clsx() function calls
          CallExpression(node) {
            if (
              node.callee &&
              (node.callee.name === 'cn' || node.callee.name === 'clsx')
            ) {
              node.arguments.forEach((arg) => {
                if (arg.type === 'Literal') {
                  checkForHardcodedColors(node, arg.value);
                } else if (arg.type === 'TemplateLiteral') {
                  arg.quasis.forEach((quasi) => {
                    checkForHardcodedColors(node, quasi.value.raw);
                  });
                }
              });
            }
          },
        };
      },
    },
  },
};
