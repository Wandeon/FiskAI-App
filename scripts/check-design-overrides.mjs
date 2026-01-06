#!/usr/bin/env node

/**
 * @design-override Budget Checker
 *
 * Counts all @design-override comments in the codebase and ensures
 * we don't backslide on design token adoption.
 *
 * Usage:
 *   node scripts/check-design-overrides.mjs         # Check against budget
 *   node scripts/check-design-overrides.mjs --list  # List all overrides
 *   node scripts/check-design-overrides.mjs --set   # Update budget to current count
 *
 * Exit codes:
 *   0 - Under or at budget
 *   1 - Over budget (CI failure)
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUDGET_FILE = join(__dirname, '..', '.design-override-budget');

// Current budget - this should only increase with good justification
const DEFAULT_BUDGET = 25;

function getBudget() {
  if (existsSync(BUDGET_FILE)) {
    const content = readFileSync(BUDGET_FILE, 'utf-8').trim();
    const budget = parseInt(content, 10);
    if (!isNaN(budget)) return budget;
  }
  return DEFAULT_BUDGET;
}

function setBudget(count) {
  writeFileSync(BUDGET_FILE, `${count}\n`);
  console.log(`Budget set to ${count}`);
}

function getOverrides() {
  try {
    // Search for @design-override in all source files
    const result = execSync(
      `grep -rn "@design-override" src/ --include="*.tsx" --include="*.ts" --include="*.css" 2>/dev/null || true`,
      { encoding: 'utf-8', cwd: join(__dirname, '..') }
    );

    if (!result.trim()) return [];

    return result.trim().split('\n').map(line => {
      const match = line.match(/^([^:]+):(\d+):(.*)$/);
      if (!match) return null;

      const [, file, lineNum, content] = match;
      // Extract the reason after @design-override:
      const reasonMatch = content.match(/@design-override:\s*(.+?)(?:\*\/|$)/);
      const reason = reasonMatch ? reasonMatch[1].trim() : '(no reason given)';

      return {
        file: file.replace(/^\.\//, ''),
        line: parseInt(lineNum, 10),
        reason
      };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function main() {
  const args = process.argv.slice(2);
  const listMode = args.includes('--list');
  const setMode = args.includes('--set');

  const overrides = getOverrides();
  const count = overrides.length;
  const budget = getBudget();

  if (setMode) {
    setBudget(count);
    process.exit(0);
  }

  console.log(`\n@design-override Usage Report`);
  console.log('='.repeat(40));
  console.log(`Current count: ${count}`);
  console.log(`Budget:        ${budget}`);
  console.log(`Status:        ${count <= budget ? '✅ UNDER BUDGET' : '❌ OVER BUDGET'}`);

  if (listMode && overrides.length > 0) {
    console.log('\nOverrides by file:');
    console.log('-'.repeat(40));

    // Group by file
    const byFile = {};
    for (const o of overrides) {
      if (!byFile[o.file]) byFile[o.file] = [];
      byFile[o.file].push(o);
    }

    for (const [file, items] of Object.entries(byFile)) {
      console.log(`\n${file}:`);
      for (const item of items) {
        console.log(`  L${item.line}: ${item.reason}`);
      }
    }
  }

  if (count > budget) {
    console.log(`\n⚠️  ${count - budget} override(s) over budget!`);
    console.log('Either remove overrides or increase budget with justification.');
    console.log('To list all overrides: node scripts/check-design-overrides.mjs --list');
    process.exit(1);
  }

  console.log('');
  process.exit(0);
}

main();
