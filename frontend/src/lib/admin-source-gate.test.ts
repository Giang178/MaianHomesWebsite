import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, it} from 'vitest';

const roots = [
  'src/app/(admin)',
  'src/features/accounts',
  'src/features/content',
  'src/features/system',
  'src/features/team',
  'src/features/website',
  'src/features/workspaces',
];
const sourceFiles = roots.flatMap((root) => {
  const absolute = path.resolve(process.cwd(), root);
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) files.push(full);
    }
  };
  visit(absolute);
  return files;
});

describe('Admin production feedback gate', () => {
  it('does not use native dialogs or console as a user-facing channel', () => {
    const violations = [];
    const forbidden = /(?:window\.)?(?:alert|prompt|confirm)\s*\(|console\.(?:log|warn|error|info|debug)\s*\(/;
    for (const file of sourceFiles) {
      const contents = fs.readFileSync(file, 'utf8');
      if (forbidden.test(contents)) violations.push(path.relative(process.cwd(), file));
    }
    expect(violations).toEqual([]);
  });
});
