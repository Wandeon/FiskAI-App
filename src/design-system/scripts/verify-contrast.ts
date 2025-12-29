/**
 * WCAG Contrast Verification Script
 *
 * Verifies that all semantic color tokens meet WCAG 2.1 accessibility standards.
 * Checks contrast ratios for text/background combinations and reports violations.
 */

interface ColorPair {
  foreground: string;
  background: string;
  purpose: string;
  minRatio: number; // WCAG requirement
}

interface ContrastResult {
  pair: ColorPair;
  ratio: number;
  passes: boolean;
  level: 'AAA' | 'AA' | 'Fail';
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate relative luminance
 * https://www.w3.org/TR/WCAG20-TECHS/G17.html
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const rsRGB = rgb.r / 255;
  const gsRGB = rgb.g / 255;
  const bsRGB = rgb.b / 255;

  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 * https://www.w3.org/TR/WCAG20-TECHS/G17.html
 */
function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Determine WCAG level based on contrast ratio
 */
function getWCAGLevel(ratio: number, minRequired: number): 'AAA' | 'AA' | 'Fail' {
  if (ratio >= 7.0) return 'AAA';
  if (ratio >= minRequired) return 'AA';
  return 'Fail';
}

/**
 * Color pairs to verify
 * Light mode colors
 */
const lightModePairs: ColorPair[] = [
  // Text on surfaces
  {
    foreground: '#0f172a', // text-primary
    background: '#ffffff', // surface-0
    purpose: 'Primary text on white surface',
    minRatio: 4.5, // Normal text
  },
  {
    foreground: '#334155', // text-secondary
    background: '#ffffff', // surface-0
    purpose: 'Secondary text on white surface',
    minRatio: 4.5,
  },
  {
    foreground: '#475569', // text-tertiary
    background: '#ffffff', // surface-0
    purpose: 'Tertiary text on white surface',
    minRatio: 4.5,
  },
  {
    foreground: '#94a3b8', // text-disabled
    background: '#ffffff', // surface-0
    purpose: 'Disabled text on white surface',
    minRatio: 3.0, // Large text only
  },
  {
    foreground: '#2563eb', // text-link
    background: '#ffffff', // surface-0
    purpose: 'Link text on white surface',
    minRatio: 4.5,
  },

  // Text on base
  {
    foreground: '#0f172a', // text-primary
    background: '#f8fafc', // surface-base
    purpose: 'Primary text on page background',
    minRatio: 4.5,
  },

  // Success
  {
    foreground: '#047857', // success-text
    background: '#ecfdf5', // success-bg
    purpose: 'Success text on success background',
    minRatio: 4.5,
  },

  // Warning
  {
    foreground: '#b45309', // warning-text
    background: '#fffbeb', // warning-bg
    purpose: 'Warning text on warning background',
    minRatio: 4.5,
  },

  // Danger
  {
    foreground: '#b91c1c', // danger-text
    background: '#fef2f2', // danger-bg
    purpose: 'Danger text on danger background',
    minRatio: 4.5,
  },

  // Info
  {
    foreground: '#1d4ed8', // info-text
    background: '#eff6ff', // info-bg
    purpose: 'Info text on info background',
    minRatio: 4.5,
  },
];

/**
 * Dark mode colors
 */
const darkModePairs: ColorPair[] = [
  // Text on surfaces
  {
    foreground: '#f8fafc', // text-primary
    background: '#0f172a', // surface-0
    purpose: 'Primary text on dark surface',
    minRatio: 4.5,
  },
  {
    foreground: '#94a3b8', // text-secondary
    background: '#0f172a', // surface-0
    purpose: 'Secondary text on dark surface',
    minRatio: 4.5,
  },
  {
    foreground: '#64748b', // text-tertiary
    background: '#0f172a', // surface-0
    purpose: 'Tertiary text on dark surface',
    minRatio: 4.5,
  },
  {
    foreground: '#475569', // text-disabled
    background: '#0f172a', // surface-0
    purpose: 'Disabled text on dark surface',
    minRatio: 3.0, // Large text only
  },
  {
    foreground: '#60a5fa', // text-link
    background: '#0f172a', // surface-0
    purpose: 'Link text on dark surface',
    minRatio: 4.5,
  },

  // Text on base
  {
    foreground: '#f8fafc', // text-primary
    background: '#020617', // surface-base
    purpose: 'Primary text on dark page background',
    minRatio: 4.5,
  },

  // Success
  {
    foreground: '#34d399', // success-text
    background: '#0f172a', // Approximate for rgba(16,185,129,0.1) over dark
    purpose: 'Success text on success background (dark)',
    minRatio: 4.5,
  },

  // Warning
  {
    foreground: '#fbbf24', // warning-text
    background: '#0f172a', // Approximate for rgba(245,158,11,0.1) over dark
    purpose: 'Warning text on warning background (dark)',
    minRatio: 4.5,
  },

  // Danger
  {
    foreground: '#f87171', // danger-text
    background: '#0f172a', // Approximate for rgba(239,68,68,0.1) over dark
    purpose: 'Danger text on danger background (dark)',
    minRatio: 4.5,
  },

  // Info
  {
    foreground: '#60a5fa', // info-text
    background: '#0f172a', // Approximate for rgba(59,130,246,0.1) over dark
    purpose: 'Info text on info background (dark)',
    minRatio: 4.5,
  },
];

/**
 * Verify all color pairs
 */
function verifyContrast(): void {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     WCAG Contrast Verification for FiskAI Design System     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  const allPairs = [
    { mode: 'Light Mode', pairs: lightModePairs },
    { mode: 'Dark Mode', pairs: darkModePairs },
  ];

  let totalTests = 0;
  let passedTests = 0;
  let aaaTests = 0;

  const results: ContrastResult[] = [];

  for (const { mode, pairs } of allPairs) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`${mode.toUpperCase()}`);
    console.log(`${'='.repeat(70)}\n`);

    for (const pair of pairs) {
      totalTests++;
      const ratio = getContrastRatio(pair.foreground, pair.background);
      const passes = ratio >= pair.minRatio;
      const level = getWCAGLevel(ratio, pair.minRatio);

      if (passes) passedTests++;
      if (level === 'AAA') aaaTests++;

      results.push({ pair, ratio, passes, level });

      // Visual indicator
      const indicator = passes ? '✓' : '✗';
      const color = passes ? '\x1b[32m' : '\x1b[31m'; // Green or red
      const reset = '\x1b[0m';

      console.log(`${color}${indicator}${reset} ${pair.purpose}`);
      console.log(`  FG: ${pair.foreground} | BG: ${pair.background}`);
      console.log(`  Ratio: ${ratio.toFixed(2)}:1 | Required: ${pair.minRatio}:1 | Level: ${level}`);
      console.log();
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total tests:     ${totalTests}`);
  console.log(`Passed (AA+):    ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  console.log(`AAA level:       ${aaaTests} (${((aaaTests / totalTests) * 100).toFixed(1)}%)`);
  console.log(`Failed:          ${totalTests - passedTests}`);

  // Failed tests detail
  const failed = results.filter((r) => !r.passes);
  if (failed.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('FAILED TESTS (NEED ATTENTION)');
    console.log('='.repeat(70));
    for (const result of failed) {
      console.log(`\n✗ ${result.pair.purpose}`);
      console.log(`  Ratio: ${result.ratio.toFixed(2)}:1 (required ${result.pair.minRatio}:1)`);
      console.log(`  FG: ${result.pair.foreground}`);
      console.log(`  BG: ${result.pair.background}`);
    }
  }

  // Save results to JSON
  const reportPath = '/home/admin/fiskai-worktrees/agent-10-marketing/src/design-system/docs/contrast-report.json';
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: totalTests,
      passed: passedTests,
      aaa: aaaTests,
      failed: totalTests - passedTests,
    },
    results: results.map((r) => ({
      purpose: r.pair.purpose,
      foreground: r.pair.foreground,
      background: r.pair.background,
      ratio: parseFloat(r.ratio.toFixed(2)),
      required: r.pair.minRatio,
      level: r.level,
      passes: r.passes,
    })),
  };

  try {
    const fs = require('fs');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n✓ Report saved to: ${reportPath}`);
  } catch (error) {
    console.error('\n✗ Failed to save report:', error);
  }

  console.log('\n' + '='.repeat(70) + '\n');

  // Exit with error code if any tests failed
  if (failed.length > 0) {
    process.exit(1);
  }
}

// Run verification
verifyContrast();
