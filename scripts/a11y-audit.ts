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

/**
 * `outline: none` is only acceptable when something else draws the focus
 * indicator. A selector made of element names can be checked against the
 * last-loaded ring in a11y.css automatically; a selector made only of classes
 * cannot, because a stylesheet does not say which element a class ends up on.
 * Those go here, with the element it is really attached to and where the
 * indicator comes from. A reset that is neither covered by the ring nor listed
 * here fails the audit, and a note that no longer matches a reset also fails —
 * so the map cannot quietly grow stale and hide a regression.
 */
const OUTLINE_RESET_ATTRIBUTIONS = new Map<string, string>([
  ['src/admin.css::.admin-select', 'a <select>; the a11y.css ring matches the element'],
  ['src/admin.css::.admin-input', 'an <input>; the a11y.css ring matches the element'],
  ['src/admin.css::.admin-textarea', 'a <textarea>; the a11y.css ring matches the element'],
  ['src/admin.css::.admin-rte-area', 'a contentEditable [role="textbox"] div; .admin-shell :focus-visible (admin.css) draws its ring'],
  ['src/edu-portal.css::.er-calc-input', 'the calculator screen input; the a11y.css ring matches the element and out-specifies this reset'],
  ['src/hub.css::.hub-field', 'a text input when it is used (no markup renders it today); the a11y.css ring matches the element'],
  ['src/myschool-clean.css::.ms-search-input', 'the school-finder search input; the a11y.css ring matches the element'],
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

/**
 * The selector of the innermost rule containing `index`. Walking back to the
 * enclosing `{` keeps nested at-rules honest: a declaration inside `@media`
 * belongs to the style rule around it, not to the media prelude, and a rule
 * inside a media query must not be missed because a naive `selector { body }`
 * regex cannot see past the outer block.
 */
function enclosingSelector(css: string, index: number): string | null {
  let depth = 0;
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const character = css[cursor];
    if (character === '}') depth += 1;
    else if (character === '{') {
      if (depth === 0) {
        let start = cursor - 1;
        while (start >= 0 && !'{};'.includes(css[start])) start -= 1;
        return css.slice(start + 1, cursor).trim();
      }
      depth -= 1;
    }
  }
  return null;
}

/** `:where(a, button)` is two selectors wearing one hat; expand before judging. */
function expandSelectorWrappers(selector: string): string[] {
  const wrapper = selector.match(/:(?:where|is)\(([^()]*)\)/);
  if (!wrapper) return [selector];
  return wrapper[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => expandSelectorWrappers(selector.replace(wrapper[0], part)));
}

/** The element names and attribute selectors a ring rule matches. */
function ringScope(selectorList: string): { elements: Set<string>; attributes: Set<string> } {
  const elements = new Set<string>();
  const attributes = new Set<string>();
  for (const selector of expandSelectorWrappers(selectorList)) {
    for (const compound of selector.split(/[\s>+~]+/).filter(Boolean)) {
      const element = compound.match(/^[a-z]+/)?.[0];
      if (element) elements.add(element);
      for (const attribute of compound.match(/\[[^\]]+\]/g) ?? []) {
        attributes.add(attribute.replace(/\s+/g, '').replace(/["']/g, "'").toLowerCase());
      }
    }
  }
  return { elements, attributes };
}

/** Does the last-loaded ring in a11y.css reach this selector? */
function coveredByRing(selector: string, ring: { elements: Set<string>; attributes: Set<string> }): boolean {
  return expandSelectorWrappers(selector).every((expanded) => {
    const compound = expanded.split(/[\s>+~]+/).filter(Boolean).at(-1) ?? expanded;
    const element = compound.match(/^[a-z]+/)?.[0];
    const attributes = (compound.match(/\[[^\]]+\]/g) ?? []).map((attribute) =>
      attribute.replace(/\s+/g, '').replace(/["']/g, "'").toLowerCase(),
    );
    if (!element && attributes.length === 0) return false; // class/id only — needs a decision, not a guess
    if (element && !ring.elements.has(element)) return false;
    return attributes.every((attribute) => ring.attributes.has(attribute));
  });
}

/** sRGB relative luminance (WCAG 2.x colour-contrast definition). */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const expanded = value.length === 3 ? [...value].map((character) => character + character).join('') : value;
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(expanded.slice(offset, offset + 2), 16) / 255);
  const channel = (component: number): number => (component <= 0.03928 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two `#rgb`/`#rrggbb` colours. */
export function contrastRatio(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Every style rule in a sheet, at any nesting depth, with the body it owns.
 * A `selector { body }` regex stops at the first `}` and therefore never sees
 * the rules inside a media query; walking the braces does.
 */
function styleRules(css: string): Array<{ selector: string; body: string; index: number }> {
  const rules: Array<{ selector: string; body: string; index: number }> = [];
  const stack: number[] = [];
  for (let cursor = 0; cursor < css.length; cursor += 1) {
    if (css[cursor] === '{') {
      let start = cursor - 1;
      while (start >= 0 && !'{};'.includes(css[start])) start -= 1;
      stack.push(start + 1);
    } else if (css[cursor] === '}') {
      const start = stack.pop();
      if (start === undefined) continue;
      const open = css.indexOf('{', start);
      if (open === -1 || open > cursor) continue;
      const selector = css.slice(start, open).trim();
      const body = css.slice(open + 1, cursor);
      if (selector && !selector.startsWith('@') && !body.includes('{')) rules.push({ selector, body, index: open + 1 });
    }
  }
  return rules;
}

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
  let ringSelectorList = '';
  if (!a11y) {
    findings.push({ rule: 'focus-ring', severity: 'blocking', file: 'src/styles/a11y.css', line: 1, message: 'src/styles/a11y.css is missing — the focus ring has no last-loaded owner' });
  } else {
    const ringRules = [...a11y.matchAll(/([^{}]*:focus-visible[^{}]*)\{([^{}]*)\}/g)].map((match) => ({ selector: match[1].trim(), body: match[2] }));
    const focusRules = ringRules.map((rule) => rule.body);
    const indicator = ringRules.find((rule) => /outline:\s*(?!none|0)\S+/.test(rule.body));
    if (focusRules.length === 0) {
      findings.push({ rule: 'focus-ring', severity: 'blocking', file: 'src/styles/a11y.css', line: 1, message: ':focus-visible rule not found' });
    } else if (!indicator) {
      findings.push({ rule: 'focus-ring', severity: 'blocking', file: 'src/styles/a11y.css', line: 1, message: ':focus-visible does not set a visible outline' });
    } else if (/rgba\([^)]*,\s*0?\.\d+\s*\)/.test(indicator.body)) {
      findings.push({ rule: 'focus-ring', severity: 'blocking', file: 'src/styles/a11y.css', line: 1, message: ':focus-visible uses a translucent colour, which loses the 3:1 indicator contrast' });
    } else {
      // The ring that other stylesheets have to answer to, read from the file
      // itself so widening the ring widens the coverage check with it.
      ringSelectorList = indicator.selector;
    }
    const imports = mainTsx.match(/import\s+'\.\/[^']+\.css';/g) ?? [];
    const last = imports.at(-1);
    if (last !== "import './styles/a11y.css';") {
      findings.push({ rule: 'focus-ring-order', severity: 'blocking', file: 'src/main.tsx', line: 1, message: `a11y.css must be the last stylesheet import (found ${last ?? 'none'})` });
    }
  }

  // Every `outline: none` has to be attributable to an indicator: either the
  // selector names its own focus state, or it applies only while hovered (a
  // pointer cannot reach an element the keyboard ring does not already cover),
  // or its element kind is one the last-loaded ring matches, or it is written
  // down in OUTLINE_RESET_ATTRIBUTIONS with the reason. A reset with none of
  // those is how a control ends up with no visible focus at all.
  const ring = ringScope(ringSelectorList);
  const attributed = new Set<string>();
  let outlineResets = 0;
  for (const [file, rawCss] of stylesheets) {
    const css = stripCssComments(rawCss);
    for (const match of css.matchAll(/outline:\s*(?:none|0)\b/g)) {
      const selector = enclosingSelector(css, match.index ?? 0);
      if (!selector) continue;
      outlineResets += 1;
      const line = css.slice(0, match.index).split('\n').length;
      const parts = expandSelectorWrappers(selector)
        .flatMap((expanded) => expanded.split(','))
        .map((piece) => piece.trim())
        .filter(Boolean);
      for (const part of parts) {
        if (/^@/.test(part) || /^(from|to|[\d.]+%)$/.test(part)) continue; // keyframe steps, at-rule preludes
        if (/:focus(-visible)?\b/.test(part)) continue; // the author declares the focus state here
        if (/:hover\b/.test(part)) continue; // hover alone cannot remove the keyboard ring
        if (coveredByRing(part, ring)) continue;
        const key = `${file}::${part}`;
        if (OUTLINE_RESET_ATTRIBUTIONS.has(key)) {
          attributed.add(key);
          continue;
        }
        findings.push({
          rule: 'focus-indicator-coverage',
          severity: 'blocking',
          file,
          line,
          message: `\`${part}\` removes the outline and nothing draws a focus indicator back — give it a :focus-visible rule, widen the a11y.css ring, or add it to OUTLINE_RESET_ATTRIBUTIONS with the element and the reason`,
        });
      }
    }
  }
  for (const [key, reason] of OUTLINE_RESET_ATTRIBUTIONS) {
    if (attributed.has(key)) continue;
    findings.push({
      rule: 'focus-indicator-coverage',
      severity: 'blocking',
      file: key.split('::')[0],
      line: 1,
      message: `OUTLINE_RESET_ATTRIBUTIONS lists \`${key.split('::')[1]}\` ("${reason}") but that selector no longer resets the outline — delete the note so it cannot hide a future gap`,
    });
  }
  findings.push({ rule: 'outline-resets', severity: 'info', file: 'src/**/*.css', line: 1, message: `${outlineResets} outline:none/0 declarations, each attributed to a focus indicator (${attributed.size} by explicit note, the rest by the a11y.css ring or their own :focus-visible)` });

  // Contrast, statically. When one rule states both the text colour and the
  // background, the pair is exact — this is the same arithmetic axe runs per
  // rendered node, applied to the stylesheet, so the answer does not depend on
  // a screenshot or on the route being reachable. Rule-scoped pairs are the
  // common case in this codebase; text that inherits its background from an
  // ancestor still needs axe, and gradients/rgba()/images are skipped because
  // there is no single colour to compare against. The 3:1 large-text allowance
  // is read from the rule's own font-size and font-weight.
  const hex = String.raw`#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b`;
  for (const [file, rawCss] of stylesheets) {
    const css = stripCssComments(rawCss);
    for (const { selector, body, index } of styleRules(css)) {
      const colour = body.match(new RegExp(String.raw`(?:^|;)\s*color\s*:\s*(${hex})`, 'i'));
      const background = body.match(new RegExp(String.raw`(?:^|;)\s*background(?:-color)?\s*:\s*(${hex})\s*(?:;|$)`, 'i'));
      if (!colour || !background) continue;
      const font = body.match(/font-size\s*:\s*([\d.]+)px/i);
      const weight = body.match(/font-weight\s*:\s*(\d{3}|bold)/i);
      const pixels = font ? Number(font[1]) : 16;
      const bold = weight ? weight[1] === 'bold' || Number(weight[1]) >= 700 : false;
      const large = pixels >= 24 || (pixels >= 18.66 && bold);
      const required = large ? 3 : 4.5;
      const ratio = contrastRatio(colour[1], background[1]);
      if (ratio + 0.005 >= required) continue;
      findings.push({
        rule: 'text-contrast',
        severity: 'blocking',
        file,
        line: css.slice(0, index).split('\n').length,
        message: `${selector} sets color:${colour[1]} on background:${background[1]} — ${ratio.toFixed(2)}:1, under the ${required}:1 ${large ? 'large-text' : 'body-text'} minimum`,
      });
    }
  }

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
