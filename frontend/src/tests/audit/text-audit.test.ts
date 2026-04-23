import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import zhCnMessages from '../../../messages/zh-CN.json';

const SOURCE_ROOTS = ['src/app', 'src/components', 'src/lib'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      return collectSourceFiles(path);
    }

    if (!SOURCE_EXTENSIONS.has(path.slice(path.lastIndexOf('.')))) {
      return [];
    }

    if (path.includes('.test.') || path.includes('.spec.') || path.endsWith('.d.ts')) {
      return [];
    }

    return [path];
  });
}

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix.slice(0, -1)];
  }

  return Object.entries(value).flatMap(([key, child]) => flattenKeys(child, `${prefix}${key}.`));
}

describe('text audit', () => {
  it('keeps the Chinese message catalog valid', () => {
    expect(flattenKeys(zhCnMessages).sort()).toContain('brand.productName');
  });

  it('does not ship placeholder or fallback copy in source files', () => {
    const forbidden = [
      { name: 'Chinese empty placeholder', pattern: /暂无数据/ },
      { name: 'lorem ipsum', pattern: /\blorem ipsum\b/i },
      { name: 'copy TODO', pattern: /TODO copy/i },
      { name: 'bare no data', pattern: /\bNo data\b/i },
    ];
    const violations = SOURCE_ROOTS.flatMap((root) =>
      collectSourceFiles(root).flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        return forbidden
          .filter((rule) => rule.pattern.test(source))
          .map((rule) => `${relative(process.cwd(), file)}: ${rule.name}`);
      })
    );

    expect(violations).toEqual([]);
  });
});
