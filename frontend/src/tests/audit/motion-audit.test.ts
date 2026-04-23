import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const MOTION_SCAN_ROOTS = ['src/app', 'src/components'];

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return collectSourceFiles(path);
    }

    if ((!path.endsWith('.tsx') && !path.endsWith('.ts')) || path.includes('.test.') || path.includes('.spec.')) {
      return [];
    }

    return [path];
  });
}

describe('motion audit', () => {
  it('defines motion tokens and reduced-motion overrides globally', () => {
    const globals = readFileSync('src/app/globals.css', 'utf8');

    expect(globals).toContain('--duration-instant');
    expect(globals).toContain('--duration-fast');
    expect(globals).toContain('--duration-base');
    expect(globals).toContain('--duration-slow');
    expect(globals).toContain('@media (prefers-reduced-motion: reduce)');
  });

  it('does not introduce inline hardcoded animation durations', () => {
    const violations = MOTION_SCAN_ROOTS.flatMap((root) =>
      collectSourceFiles(root).flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        const matches = [...source.matchAll(/\b(?:transitionDuration|animationDuration)\s*:/g)];
        return matches.map((match) => `${relative(process.cwd(), file)}: ${match[0]}`);
      })
    );

    expect(violations).toEqual([]);
  });

  it('keeps tokenized duration utilities available for new animated primitives', () => {
    const sources = MOTION_SCAN_ROOTS.flatMap(collectSourceFiles)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect((sources.match(/duration-\[var\(--duration-/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });
});
