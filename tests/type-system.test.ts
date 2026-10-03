import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// APP-1 / CONSISTENCY-1: the product had 96 declarations at 750–900 across 14
// stylesheets and 12 `font-weight: … !important` overrides, which is why nothing
// looked emphasised — everything did. This test keeps the scale closed: weights
// may only be one of the six role values, and no component sheet may shout over
// the type layer with !important.
//
// It asserts the *rule*, not a rendered look, so a redesign that keeps the scale
// keeps passing.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stylesDir = join(root, 'src');

const SCALE = [400, 500, 560, 620, 680, 730];
const ROLE_NAMES: Record<number, string> = {
  400: 'body',
  500: 'meta',
  560: 'label',
  620: 'subhead',
  680: 'numeric',
  730: 'title',
};

function appStylesheets(): string[] {
  return readdirSync(stylesDir)
    .filter((name) => name.endsWith('.css'))
    .map((name) => join(stylesDir, name));
}

test('every literal font weight is a step on the role scale', () => {
  const offenders: string[] = [];
  for (const file of appStylesheets()) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/font-weight:\s*(\d{1,4})/g)) {
      const weight = Number(match[1]);
      if (!SCALE.includes(weight)) {
        const line = source.slice(0, match.index).split('\n').length;
        offenders.push(`${file.replace(root + '/', '')}:${line} font-weight: ${weight}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `off-scale weights (${Object.entries(ROLE_NAMES).map(([w, n]) => `${w}=${n}`).join(', ')}):\n${offenders.join('\n')}`,
  );
});

test('inline font weights use the same scale', () => {
  // The same defect class lived in `style={{ fontWeight: 800 }}` on 79 elements,
  // where the stylesheet guard could not see it.
  const offenders: string[] = [];
  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(path));
      else if (entry.name.endsWith('.tsx')) out.push(path);
    }
    return out;
  };
  for (const file of [...walk('pages'), ...walk('src')]) {
    const source = readFileSync(join(root, file), 'utf8');
    for (const match of source.matchAll(/fontWeight:\s*(\d{1,4})/g)) {
      const weight = Number(match[1]);
      if (!SCALE.includes(weight)) {
        const line = source.slice(0, match.index).split('\n').length;
        offenders.push(`${file}:${line} fontWeight: ${weight}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `inline weights must be on the same scale:\n${offenders.join('\n')}`);
});

test('no component sheet overrides a weight with !important', () => {
  const offenders: string[] = [];
  for (const file of appStylesheets()) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/font-weight:\s*[^;}]*!important/g)) {
      const line = source.slice(0, match.index).split('\n').length;
      offenders.push(`${file.replace(root + '/', '')}:${line} ${match[0].trim()}`);
    }
  }
  assert.deepEqual(offenders, [], `the type layer wins on role, not on force:\n${offenders.join('\n')}`);
});

test('the type system defines the scale once and is loaded after the component sheets', () => {
  const typeSystem = readFileSync(join(stylesDir, 'styles', 'type-system.css'), 'utf8');
  for (const weight of SCALE) {
    assert.match(
      typeSystem,
      new RegExp(`:\\s*${weight};|font-weight:\\s*${weight}`),
      `${weight} (${ROLE_NAMES[weight]}) is part of the documented scale`,
    );
  }
  const main = readFileSync(join(root, 'src', 'main.tsx'), 'utf8');
  const imports = [...main.matchAll(/import\s+'(\.[^']*\.css)'/g)].map((m) => m[1]);
  const typeIndex = imports.findIndex((path) => path.includes('type-system.css'));
  assert.ok(typeIndex > -1, 'main.tsx loads the type system');
  assert.equal(typeIndex, imports.length - 2, 'the type layer loads after the component sheets and before a11y.css');
  assert.match(imports[imports.length - 1], /a11y\.css$/, 'a11y.css stays last, as the focus-ring order test requires');
});
