import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SCAN_ROOTS = ['src/app', 'src/components'];

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return collectTsxFiles(path);
    }

    if (!path.endsWith('.tsx') || path.includes('.test.') || path.includes('.spec.')) {
      return [];
    }

    return [path];
  });
}

function getTagBlocks(source: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}\\b[\\s\\S]*?>`, 'g');
  return [...source.matchAll(regex)].map((match) => match[0]);
}

describe('a11y audit', () => {
  it('requires alt text and lazy loading on raw images', () => {
    const violations = SCAN_ROOTS.flatMap((root) =>
      collectTsxFiles(root).flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        return getTagBlocks(source, 'img')
          .filter((tag) => !/\balt=/.test(tag) || !/\bloading="lazy"/.test(tag) || !/\bdecoding="async"/.test(tag))
          .map((tag) => `${relative(process.cwd(), file)}: ${tag.replace(/\s+/g, ' ')}`);
      })
    );

    expect(violations).toEqual([]);
  });

  it('keeps icon-only buttons discoverable to screen readers', () => {
    const violations = SCAN_ROOTS.flatMap((root) =>
      collectTsxFiles(root).flatMap((file) => {
        if (file.includes('/components/ui/')) {
          return [];
        }

        const source = readFileSync(file, 'utf8');
        const matches = [
          ...source.matchAll(/<(Button|button)\b(?:(?:"[^"]*")|(?:'[^']*')|[^'">])*?>/g),
        ].filter((match) => /\bsize="icon(?:-[^"]+)?"/.test(match[0]));

        return matches
          .filter((match) => {
            const nearby = source.slice(match.index ?? 0, (match.index ?? 0) + 800);
            return !/\baria-label=/.test(nearby) && !/\bsr-only\b/.test(nearby);
          })
          .map((match) => `${relative(process.cwd(), file)}: ${match[0].replace(/\s+/g, ' ')}`);
      })
    );

    expect(violations).toEqual([]);
  });
});
