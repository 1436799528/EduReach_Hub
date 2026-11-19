import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

// UX-10: the interaction patterns the product promised in one place.
//
// These assertions cover the half that a screenshot cannot: what the markup
// declares, which keys move, how long a toast lives, and whether a menu can be
// dismissed without hunting for the trigger again. The imported primitives are
// exercised directly where they are pure; everything else is a source contract,
// the same style the rest of this suite uses.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): string => readFileSync(join(root, path), 'utf8');

const tabs = read('src/components/ui/Tabs.tsx');
const toast = read('src/components/ui/Toast.tsx');
const menu = read('src/lib/menuA11y.ts');
const dialog = read('src/lib/useModalDialog.ts');
const layout = read('src/components/HubLayout.tsx');
const adminSite = read('pages/AdminSitePage.tsx');
const auth = read('pages/AuthPageV2.tsx');
const interactions = read('src/styles/ux9-microinteractions.css');
const a11yCss = read('src/styles/a11y.css');

const { nextTabIndex } = await import('../src/components/ui/Tabs');
const { DURATION_BY_TONE, TOAST_SWIPE_THRESHOLD } = await import('../src/components/ui/Toast');

test('arrow keys move between tabs, wrap at both ends, and Home/End jump', () => {
  assert.equal(nextTabIndex(0, 3, 'ArrowRight'), 1);
  assert.equal(nextTabIndex(1, 3, 'ArrowRight'), 2);
  assert.equal(nextTabIndex(2, 3, 'ArrowRight'), 0, 'the last tab wraps to the first');
  assert.equal(nextTabIndex(0, 3, 'ArrowLeft'), 2, 'the first tab wraps to the last');
  assert.equal(nextTabIndex(1, 3, 'ArrowLeft'), 0);
  assert.equal(nextTabIndex(2, 3, 'Home'), 0);
  assert.equal(nextTabIndex(0, 3, 'End'), 2);
  assert.equal(nextTabIndex(1, 3, 'Tab'), -1, 'Tab leaves the strip instead of being swallowed');
  assert.equal(nextTabIndex(1, 3, 'Enter'), -1);
  assert.equal(nextTabIndex(0, 0, 'ArrowRight'), -1);
});

test('a tab strip has one tab stop, real tabpanels, and a sliding indicator', () => {
  assert.match(tabs, /tabIndex=\{selected \? 0 : -1\}/, 'roving tabindex, not one stop per tab');
  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /role="tab"/);
  assert.match(tabs, /role="tabpanel"/);
  assert.match(tabs, /aria-controls=\{item\.panel !== undefined/, 'each tab names the panel it opens');
  assert.match(tabs, /aria-labelledby=\{`\$\{baseId\}-tab-/, 'each panel names the tab that opened it');
  assert.match(tabs, /aria-orientation=\{orientation\}/);
  assert.match(tabs, /--er-indicator-x/, 'the indicator is positioned, not restyled in place');
  assert.match(interactions, /\.er-tabs-indicator[\s\S]*?transition:\s*\n?\s*transform 300ms cubic-bezier/, 'the indicator slides');
  assert.match(interactions, /\.er-tab\.is-selected \{ color: var\(--er-tabs-ink/, 'the selected ink is its own token');
  // The two states must not share a colour: the ring is cobalt blue, the
  // selected tab is ink. Asserting both makes the contrast explicit.
  assert.match(a11yCss, /outline: 2px solid var\(--color-focus, #1E40AF\) !important/, 'the focus ring stays brand blue');
  assert.doesNotMatch(interactions, /--er-tabs-ink: var\(--er-primary/, 'the active ink is never the ring colour');
});

test('an overflowing tab row scrolls with edge fades instead of wrapping', () => {
  assert.match(interactions, /\.er-tabs-strip \{[\s\S]*?overflow-x: auto/);
  assert.doesNotMatch(interactions, /\.er-tabs-strip \{[^}]*flex-wrap: wrap/, 'a tab row never wraps to a second line');
  assert.match(interactions, /data-overflow-right="true"[\s\S]*mask-image/, 'the right edge fades when more tabs exist');
  assert.match(interactions, /data-overflow-left="true"/, 'the left edge fades once the row is scrolled');
  assert.match(tabs, /er-tabs-scroll/, 'desktop gets chevron buttons');
  assert.match(interactions, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*data-scrollable="true"\] \.er-tabs-scroll \{ display: grid/, 'chevrons are a pointer affordance');
});

test('a phone with under five tabs gets a segmented control, not a shrunken bar', () => {
  assert.match(tabs, /const mobile = items\.length <= 4 \? 'segmented' : 'scroll'/);
  assert.match(interactions, /@media \(max-width: 640px\) \{\s*\.er-tabs-bar\[data-mobile="segmented"\]/);
  assert.match(interactions, /data-mobile="segmented"[\s\S]*?border-radius: 11px/, 'the segmented control is a single pale pill');
});

test('switching tabs fades out, pauses, then fades in without shifting the page', () => {
  assert.match(tabs, /const FADE_OUT_MS = 80/);
  assert.match(tabs, /const FADE_IN_MS = 160/);
  assert.match(tabs, /setLeaving\(true\)/, 'the old panel fades before the new one mounts');
  assert.match(tabs, /setLockedHeight\(from\)/, 'the previous height is held so nothing jumps');
  assert.match(interactions, /\.er-tabs-panel\.is-leaving \{ opacity: 0; transition: opacity 80ms/);
  assert.match(interactions, /\.er-tabs-panel\.is-entering \{ animation: er-tabs-fade-in 160ms/);
  assert.match(interactions, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*\.er-tabs-indicator/, 'reduced motion drops the spring');
});

test('both header menus close on an outside press, on Escape, and on focus leaving', () => {
  assert.match(menu, /document\.addEventListener\('pointerdown', closeOutside\)/);
  assert.match(menu, /closeOnEscape[\s\S]*?triggerRef\.current\?\.focus\(\)/, 'Escape returns focus to the trigger');
  assert.match(menu, /addEventListener\('focusout', closeOnFocusOut\)/, 'tabbing away cannot leave an orphaned panel');
  assert.match(menu, /pressedInside/, 'clicking the menu chrome does not dismiss it');
  assert.match(menu, /ArrowDown[\s\S]*?ArrowUp[\s\S]*?Home[\s\S]*?End/, 'the items are reachable by arrow keys');
  assert.match(layout, /useMenuDismiss\(\{ open: profileOpen/, 'the account menu uses the contract');
  assert.match(layout, /useMenuDismiss\(\{ open: moreOpen/, 'the More menu uses the contract');
  assert.match(layout, /role="menuitem"/, 'its rows are real menu items');
  assert.match(layout, /className="er-menu"/, 'and inherit the shared 150ms open animation');
  assert.match(interactions, /\.er-menu \{[\s\S]*?animation: er-menu-in 150ms/, 'menus open in ~150ms');
  assert.match(interactions, /\.er-menu \{[\s\S]*?max-height: min\(70vh/, 'a long menu can never run off the screen');
  assert.match(interactions, /\.er-menu-item:hover/, 'every row has a hover state');
});

test('the right mobile drawer traps focus, locks the page and closes on an outer press', () => {
  assert.match(layout, /useModalDialog<HTMLDivElement>\(mobileOpen/, 'one focus-managed dialog owns the drawer');
  assert.match(layout, /useDrawerDismiss\(\{ open: mobileOpen/, 'outside presses dismiss it');
  assert.match(menu, /document\.body\.style\.overflow = 'hidden'/, 'the page behind cannot scroll');
  assert.match(menu, /pointerdown[\s\S]*?click/, 'both pointer and synthetic outer clicks close it');
  assert.match(dialog, /event\.key !== 'Tab'/, 'Tab is intercepted at the drawer edge');
  assert.match(dialog, /if \(first\) first\.focus\(\)/, 'focus starts inside the drawer');
  assert.match(layout, /justifyContent: 'flex-end'/, 'the drawer is pinned to the right');
  assert.match(layout, /overflowY: 'auto'/, 'long menu content scrolls inside the drawer');
});

test('toast lifetimes match severity, and a failure never dismisses itself', () => {
  assert.equal(DURATION_BY_TONE.success, 4000);
  assert.equal(DURATION_BY_TONE.info, 4000);
  assert.equal(DURATION_BY_TONE.warning, 7000);
  assert.equal(DURATION_BY_TONE.danger, 0, 'a critical error waits for acknowledgement');
  assert.match(toast, /item\.duration \?\? DURATION_BY_TONE\[tone\]/, 'an explicit duration still wins');
});

test('toasts pause while read, cap at three, queue the rest, and swipe away on a phone', () => {
  assert.match(toast, /const MAX_VISIBLE = 3/);
  assert.match(toast, /items\.slice\(-MAX_VISIBLE\)/, 'the newest three render; the rest queue');
  assert.match(toast, /onMouseEnter=\{\(\) => setPaused\(true\)\}/, 'hover pauses the countdown');
  assert.match(toast, /onFocus=\{\(\) => setPaused\(true\)\}/, 'keyboard focus pauses it too');
  assert.match(toast, /remaining\.current = Math\.max\(0, remaining\.current -/, 'pausing keeps the remaining time');
  assert.equal(TOAST_SWIPE_THRESHOLD, 64);
  assert.match(toast, /event\.pointerType !== 'touch'/, 'swipe is a touch gesture, not a desktop surprise');
  assert.match(interactions, /\.er-toast \{[\s\S]*?border-left-width: 3px/, 'colour is reinforced by a left accent border');
  assert.match(interactions, /\.er-toast--danger \{ border-left-color: var\(--er-status-error/, 'each tone has its own accent');
  assert.match(interactions, /@media \(max-width: 640px\) \{\s*\.er-toast-viewport \{\s*bottom: calc\(62px \+ env\(safe-area-inset-bottom\) \+ 10px\)/, 'a phone toast sits above the tab bar instead of on it');
});

test('the admin settings surface marks what changed and resets one group at a time', () => {
  assert.match(adminSite, /const \[savedSettings, setSavedSettings\]/, 'the form compares against the saved copy');
  assert.match(adminSite, /<span className="admin-pill is-warn">Modified<\/span>/);
  assert.match(adminSite, /Reset \{noun\}/);
  assert.equal((adminSite.match(/<SettingChanges /g) || []).length, 4, 'each save group carries its own indicator');
  assert.match(adminSite, /Reverted to the last saved version\. Nothing was written\./, 'a reset is local until saved');
  assert.match(adminSite, /<Tabs/, 'the two panels use the shared tab system');
  assert.match(auth, /<TabBar/, 'the auth switch uses the shared tab bar');
  assert.match(auth, /variant="segmented"/, 'two equal choices are a segmented control');
});
