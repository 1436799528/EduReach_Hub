import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// A11Y-1: the static half of the accessibility posture.
//
// This is deliberately an AST scan, not a regex scan. A regex over JSX dies on
// the first `>` inside an inline handler — `onChange={(event) => setQuery(...)}`
// truncates the "tag" before the `aria-label` that is actually there, which is
// how the first hand-scan produced dozens of false unnamed-control findings.
// The TypeScript parser reads JSX the way the bundler does.
//
// Rules that block: a control without an accessible name, a dialog without a
// name or without focus management, a table header without `scope`, a second
// `<main>` nested inside the layout's, a pointer-only click target, a shell
// without a skip link (or without the skip link's target), an image without
// `alt`, `aria-invalid` without `aria-describedby`, an animation that ignores
// `prefers-reduced-motion`, and a focus ring that a later stylesheet can erase.
//
// See docs/features/A11Y-1.md. `tests/a11y.test.ts` fails on any blocking rule.

export type Severity = 'blocking' | 'info';

export interface Finding {
  rule: string;
  severity: Severity;
  file: string;
  line: number;
  message: string;
}

export interface ScanInput {
  /** repo-relative path -> source text */
  files: Map<string, string>;
}

const SHELLS = [
  'src/components/HubLayout.tsx',
  'pages/AdminLayout.tsx',
  'pages/StudentDashboardV2.tsx',
];

/** Files that manage dialog focus themselves instead of via useModalDialog. */
const DIALOG_FOCUS_ALLOWLIST = new Map<string, string>([
  ['src/components/HubLayout.tsx', 'mobile drawer: moves focus to its close button, restores the trigger, closes on Escape'],
  ['src/components/ScientificCalculator.tsx', 'calculator keypad: focuses its own input and closes on Escape'],
]);

/** Non-button elements allowed to carry onClick because a real control sits beside them. */
const CLICK_ALLOWLIST = new Map<string, string>([
  ['src/components/ScientificCalculator.tsx', 'the calculator screen is a label wrapping its own input, so the click is a native label click'],
]);

/** Colour the focus ring must reach 3:1 against; kept next to the value it judges. */
export function findSourceFiles(root: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (entry.endsWith('.tsx')) {
        files.set(relative(root, full).split('\\').join('/'), readFileSync(full, 'utf8'));
      }
    }
  };
  for (const dir of ['pages', 'src']) walk(join(root, dir));
  return files;
}

export function findStylesheets(root: string): Map<string, string> {
  const files = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (entry.endsWith('.css')) {
        files.set(relative(root, full).split('\\').join('/'), readFileSync(full, 'utf8'));
      }
    }
  };
  walk(join(root, 'src'));
  return files;
}

// --- JSX helpers ------------------------------------------------------------

function parse(file: string, source: string): ts.SourceFile {
  return ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
}

function lineOf(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function attrName(attr: ts.JsxAttribute): string {
  return attr.name.getText();
}

function getAttribute(tag: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
  if (!tag?.attributes?.properties) return undefined;
  return tag.attributes.properties.find(
    (prop): prop is ts.JsxAttribute => ts.isJsxAttribute(prop) && attrName(prop) === name,
  );
}

function hasAttribute(tag: ts.JsxOpeningLikeElement, name: string): boolean {
  return getAttribute(tag, name) !== undefined;
}

/** True when the attribute is present and not a literal empty string. */
function hasTruthyAttribute(tag: ts.JsxOpeningLikeElement, name: string): boolean {
  const attr = getAttribute(tag, name);
  if (!attr) return false;
  if (!attr.initializer) return true;
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer.text.trim() !== '';
  return true;
}

function stringAttribute(tag: ts.JsxOpeningLikeElement, name: string): string | undefined {
  const attr = getAttribute(tag, name);
  if (attr?.initializer && ts.isStringLiteral(attr.initializer)) return attr.initializer.text;
  return undefined;
}

function tagName(tag: ts.JsxOpeningLikeElement): string {
  return tag.tagName.getText();
}

function attributeText(tag: ts.JsxOpeningLikeElement, name: string): string[] {
  const attr = getAttribute(tag, name);
  if (!attr?.initializer) return [];
  const values: string[] = [];
  const collect = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) values.push(node.text);
    else if (ts.isTemplateExpression(node)) values.push(node.head.text, ...node.templateSpans.map((span) => span.literal.text));
    node.forEachChild(collect);
  };
  collect(attr.initializer);
  return values;
}

function idsInFile(source: ts.SourceFile): Set<string> {
  const ids = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && attrName(node) === 'id' && node.initializer && ts.isStringLiteral(node.initializer)) {
      ids.add(node.initializer.text);
    }
    node.forEachChild(visit);
  };
  visit(source);
  return ids;
}

function labelTargets(source: ts.SourceFile): Set<string> {
  const targets = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) && tagName(node) === 'label') {
      for (const value of attributeText(node, 'htmlFor')) targets.add(value);
    }
    node.forEachChild(visit);
  };
  visit(source);
  return targets;
}

function iconImports(source: ts.SourceFile): Set<string> {
  const icons = new Set(['svg', 'Icon']);
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const module = node.moduleSpecifier.text;
      if (module === 'lucide-react' || module.includes('/BrandLogo') || module.endsWith('BrandLogo')) {
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const element of bindings.elements) icons.add((element.name ?? element.propertyName).text);
        }
        const defaultImport = node.importClause?.name;
        if (defaultImport) icons.add(defaultImport.text);
      }
    }
    node.forEachChild(visit);
  };
  visit(source);
  return icons;
}

/** Text a screen reader would read from a button's children, ignoring icons. */
function hasReadableChildren(tag: ts.JsxOpeningLikeElement, icons: Set<string>): boolean {
  const element = tag.parent;
  if (!ts.isJsxElement(element)) return false;
  const inspect = (node: ts.Node): boolean => {
    if (ts.isJsxText(node) && node.text.trim() !== '') return true;
    if (ts.isJsxExpression(node)) {
      // {label} / {`Go`} / {count} — treat dynamic content as content.
      return node.expression !== undefined;
    }
    if (ts.isJsxElement(node)) return !icons.has(tagName(node.openingElement)) && !icons.has(tagName(node.openingElement));
    if (ts.isJsxSelfClosingElement(node)) return !icons.has(tagName(node));
    if (ts.isJsxFragment(node)) return node.children.some(inspect);
    return false;
  };
  return element.children.some(inspect);
}

function isWrappedInLabel(tag: ts.JsxOpeningLikeElement): boolean {
  let node: ts.Node | undefined = tag.parent;
  while (node) {
    if (ts.isJsxElement(node) && tagName(node.openingElement) === 'label') return true;
    node = node.parent;
  }
  return false;
}

const NON_TEXT_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image']);

// --- rules ------------------------------------------------------------------

function scanFile(file: string, text: string, findings: Finding[]): void {
  const source = parse(file, text);
  const icons = iconImports(source);
  const ids = idsInFile(source);
  const labelled = labelTargets(source);
  const rendersMain = text.includes('<main');
  const usesHubLayout = /import\s+HubLayout/.test(text);
  const usesModalHook = text.includes('useModalDialog');

  const report = (rule: string, node: ts.Node, message: string, severity: Severity = 'blocking'): void => {
    findings.push({ rule, severity, file, line: lineOf(source, node), message });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = tagName(node);

      // control-name: input/select/textarea need a programmatic name
      if (['input', 'select', 'textarea'].includes(name)) {
        const type = stringAttribute(node, 'type');
        // A file input kept in the DOM behind a styled, labelled button is a
        // proxy control: it is never focusable, so the button carries the name.
        const isHiddenProxy = type === 'file' && hasAttribute(node, 'hidden');
        const isTextInput = (name !== 'input' || !type || !NON_TEXT_INPUT_TYPES.has(type)) && !isHiddenProxy;
        if (isTextInput && !hasTruthyAttribute(node, 'aria-label') && !hasTruthyAttribute(node, 'aria-labelledby')) {
          const id = stringAttribute(node, 'id');
          if (!id || !labelled.has(id)) {
            if (!isWrappedInLabel(node)) {
              report('control-name', node, `<${name}> has no accessible name (aria-label, aria-labelledby, wrapping <label>, or a <label htmlFor> matching its id)`);
            }
          }
        }
      }

      // button-name: icon-only buttons need an explicit name
      if (name === 'button' && !hasTruthyAttribute(node, 'aria-label') && !hasTruthyAttribute(node, 'aria-labelledby') && !hasReadableChildren(node, icons)) {
        report('button-name', node, '<button> has no accessible name (only icons or nothing inside)');
      }

      // images
      if (name === 'img') {
        if (!hasAttribute(node, 'alt')) report('img-alt', node, '<img> has no alt attribute');
        else if (stringAttribute(node, 'alt') === '') {
          findings.push({ rule: 'img-empty-alt', severity: 'info', file, line: lineOf(source, node), message: '<img alt=""> — decorative; confirm a visible label sits beside it' });
        }
      }

      // dialogs
      const role = stringAttribute(node, 'role');
      if (role === 'dialog' || role === 'alertdialog') {
        const hasName = hasTruthyAttribute(node, 'aria-label') || hasTruthyAttribute(node, 'aria-labelledby');
        if (!hasName) report('dialog-name', node, `role="${role}" has no aria-label or aria-labelledby`);
        const isModal = stringAttribute(node, 'aria-modal') === 'true';
        if (isModal && !usesModalHook && !DIALOG_FOCUS_ALLOWLIST.has(file)) {
          report('dialog-focus', node, 'aria-modal="true" without focus management — use useModalDialog() or add the file to the allowlist with a reason');
        }
      }

      // th-scope
      if (name === 'th' && !hasAttribute(node, 'scope')) {
        report('th-scope', node, '<th> has no scope attribute (screen readers must guess the header axis)');
      }

      // pointer-only click targets
      if (['div', 'span', 'li', 'section', 'article'].includes(name) && hasAttribute(node, 'onClick')) {
        const hasRole = hasTruthyAttribute(node, 'role');
        const keyboard = hasAttribute(node, 'onKeyDown') || hasAttribute(node, 'onKeyUp') || hasAttribute(node, 'onKeyPress');
        const inert = stringAttribute(node, 'aria-hidden') === 'true';
        if (!hasRole && !keyboard && !inert && !CLICK_ALLOWLIST.has(file)) {
          report('click-keyboard', node, `<${name} onClick> is pointer-only — use a <button>/<a>, or add role + keyboard handling`);
        }
      }

      // aria-invalid must point at its message
      if (hasAttribute(node, 'aria-invalid') && hasTruthyAttribute(node, 'aria-invalid') && !hasTruthyAttribute(node, 'aria-describedby')) {
        report('aria-invalid-describedby', node, 'aria-invalid without aria-describedby — the error text is not associated with the field');
      }
    }

    // shell contract
    if (SHELLS.includes(file) && ts.isJsxOpeningElement(node) && tagName(node) === 'main') {
      const id = stringAttribute(node, 'id');
      if (id !== 'main-content') report('shell-main-target', node, `<main> in a shell must carry id="main-content" so the skip link can target it (found ${id ?? 'no id'})`);
    }

    node.forEachChild(visit);
  };
  visit(source);

  if (SHELLS.includes(file) && !/<SkipLink\b/.test(text)) {
    findings.push({ rule: 'skip-link', severity: 'blocking', file, line: 1, message: 'shell does not render <SkipLink> — there is no bypass mechanism' });
  }

  if (SHELLS.includes(file) && !usesModalHook && file === 'src/components/HubLayout.tsx' && !/<main/.test(text)) {
    findings.push({ rule: 'shell-main-target', severity: 'blocking', file, line: 1, message: 'shell renders no <main>' });
  }

  if (rendersMain && usesHubLayout) {
    findings.push({
      rule: 'nested-main',
      severity: 'blocking',
      file,
      line: 1,
      message: 'page renders its own <main> while also rendering HubLayout, which already renders <main> — two main landmarks on one route',
    });
  }
}

// --- CSS and document rules -------------------------------------------------

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function mediaBlocks(css: string, query: RegExp): string[] {
  const blocks: string[] = [];
  const clean = stripCssComments(css);
  for (let index = 0; index < clean.length; index += 1) {
    if (!clean.startsWith('@media', index)) continue;
    const open = clean.indexOf('{', index);
    if (open === -1) break;
    const header = clean.slice(index, open);
    let depth = 0;
    let end = open;
    for (; end < clean.length; end += 1) {
      if (clean[end] === '{') depth += 1;
      else if (clean[end] === '}') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    if (query.test(header)) blocks.push(clean.slice(open + 1, end));
    index = end;
  }
  return blocks;
}

export function scanStyles(stylesheets: Map<string, string>, indexHtml: string, mainTsx: string): Finding[] {
  const findings: Finding[] = [];

  if (!/<html[^>]*\blang=/.test(indexHtml)) {
    findings.push({ rule: 'html-lang', severity: 'blocking', file: 'index.html', line: 1, message: '<html> has no lang attribute' });
  }

  // prefers-reduced-motion must neutralise animations globally, not by name:
  // a keyframe added tomorrow would otherwise ignore the preference silently.
  let animationCount = 0;
  for (const css of stylesheets.values()) {
    animationCount += (stripCssComments(css).match(/@keyframes\s+[A-Za-z0-9_-]+/g) ?? []).length;
  }
  const reducedMotion = [...stylesheets.values()].flatMap((css) => mediaBlocks(css, /prefers-reduced-motion/)).join('\n');
  if (animationCount > 0) {
    const neutralises = /animation-duration:\s*0?\.0*1ms|animation:\s*none|animation-name:\s*none/.test(reducedMotion);
    if (!neutralises) {
      findings.push({
        rule: 'reduced-motion',
        severity: 'blocking',
        file: 'src/styles/a11y.css',
        line: 1,
        message: `${animationCount} keyframe animations exist but no prefers-reduced-motion block neutralises animation duration`,
      });
    }
  }

  // The focus ring must be defined last and must not be a translucent wash.
  const a11y = stylesheets.get('src/styles/a11y.css');
  if (!a11y) {
    findings.push({ rule: 'focus-ring', severity: 'blocking', file: 'src/styles/a11y.css', line: 1, message: 'src/styles/a11y.css is missing — the focus ring has no last-loaded owner' });
  } else {
    const focusRules = [...a11y.matchAll(/:focus-visible[^{]*\{([^}]*)\}/g)].map((match) => match[1]);
    const indicator = focusRules.find((body) => /outline:\s*(?!none|0)\S+/.test(body));
    if (focusRules.length === 0) {
      findings.push({ rule: 'focus-ring', severity: 'blocking', file: 'src/styles/a11y.css', line: 1, message: ':focus-visible rule not found' });
    } else if (!indicator) {
      findings.push({ rule: 'focus-ring', severity: 'blocking', file: 'src/styles/a11y.css', line: 1, message: ':focus-visible does not set a visible outline' });
    } else if (/rgba\([^)]*,\s*0?\.\d+\s*\)/.test(indicator)) {
      findings.push({ rule: 'focus-ring', severity: 'blocking', file: 'src/styles/a11y.css', line: 1, message: ':focus-visible uses a translucent colour, which loses the 3:1 indicator contrast' });
    }
    const imports = mainTsx.match(/import\s+'\.\/[^']+\.css';/g) ?? [];
    const last = imports.at(-1);
    if (last !== "import './styles/a11y.css';") {
      findings.push({ rule: 'focus-ring-order', severity: 'blocking', file: 'src/main.tsx', line: 1, message: `a11y.css must be the last stylesheet import (found ${last ?? 'none'})` });
    }
  }

  // Informational: outline resets are fine when a :focus-visible rule follows in
  // the same sheet, but they are worth counting so a reviewer can see the size.
  let outlineResets = 0;
  for (const css of stylesheets.values()) {
    outlineResets += (stripCssComments(css).match(/outline:\s*(none|0)\b/g) ?? []).length;
  }
  findings.push({ rule: 'outline-resets', severity: 'info', file: 'src/**/*.css', line: 1, message: `${outlineResets} outline:none/0 declarations (each must be paired with a focus indicator)` });

  return findings;
}

export function scanRepo(root: string): Finding[] {
  const findings: Finding[] = [];
  const sourceFiles = findSourceFiles(root);
  for (const [file, text] of sourceFiles) scanFile(file, text, findings);
  const stylesheets = findStylesheets(root);
  findings.push(...scanStyles(stylesheets, readFileSync(join(root, 'index.html'), 'utf8'), readFileSync(join(root, 'src/main.tsx'), 'utf8')));
  return findings;
}

export function blocking(findings: Finding[]): Finding[] {
  return findings.filter((finding) => finding.severity === 'blocking');
}

function main(): void {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const findings = scanRepo(root);
  const blockers = blocking(findings);
  const groups = new Map<string, Finding[]>();
  for (const finding of blockers) {
    const list = groups.get(finding.rule) ?? [];
    list.push(finding);
    groups.set(finding.rule, list);
  }
  for (const [rule, list] of groups) {
    console.log(`\n${rule} — ${list.length} finding${list.length === 1 ? '' : 's'}`);
    for (const finding of list.slice(0, 200)) console.log(`  ✗ ${finding.file}:${finding.line}  ${finding.message}`);
    if (list.length > 200) console.log(`  … ${list.length - 200} more`);
  }
  const info = findings.filter((finding) => finding.severity === 'info');
  for (const finding of info) console.log(`\n(info) ${finding.rule}: ${finding.message}`);
  console.log(`\nA11Y-1 audit: ${blockers.length} blocking findings, ${info.length} informational.`);
  if (blockers.length > 0) process.exitCode = 1;
  else console.log('Every static accessibility rule passes.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
