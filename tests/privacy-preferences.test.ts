import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { trackEvent } from '../src/lib/api';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import CookieConsent from '../src/components/CookieConsent';
import {
  PRIVACY_PREFERENCES_KEY,
  hasAnalyticsConsent,
  readPrivacyPreferences,
  savePrivacyPreferences,
} from '../src/lib/privacyPreferences';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://edureachhub.netlify.app' });
Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: dom.window.sessionStorage });

test('a stale stored allow cannot activate analytics during the temporary suspension', () => {
  window.localStorage.setItem(PRIVACY_PREFERENCES_KEY, JSON.stringify({ necessary: true, analytics: true, savedAt: '2026-01-01T00:00:00Z', version: 1 }));
  assert.equal(hasAnalyticsConsent(), false);
  assert.equal(readPrivacyPreferences(), null, 'legacy opt-in must require a fresh choice, not reactivate later');
  assert.equal(savePrivacyPreferences(true), null, 'a disabled option must not be reported as accepted');
  const sent: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL) => { sent.push(String(input)); return Promise.resolve(new Response(null, { status: 204 })); }) as typeof fetch;
  try { trackEvent('page_view'); assert.equal(sent.length, 0); } finally { globalThis.fetch = original; }
});

test('optional analytics are denied when no preference has been saved', () => {
  window.localStorage.clear();
  assert.equal(readPrivacyPreferences(), null);
  assert.equal(hasAnalyticsConsent(), false);
});

test('saving reject keeps necessary storage and disables analytics', () => {
  const saved = savePrivacyPreferences(false);
  assert.ok(saved);
  assert.equal(saved.necessary, true);
  assert.equal(saved.analytics, false);
  assert.equal(hasAnalyticsConsent(), false);
});

test('allow cannot be saved while optional analytics are suspended', () => {
  assert.equal(savePrivacyPreferences(true), null);
  assert.equal(hasAnalyticsConsent(), false);
});

test('malformed or unknown preference versions fail closed', () => {
  window.localStorage.setItem(PRIVACY_PREFERENCES_KEY, JSON.stringify({ version: 99, necessary: true, analytics: true }));
  assert.equal(readPrivacyPreferences(), null);
  assert.equal(hasAnalyticsConsent(), false);
});

test('tracking sends nothing with a stale allow, failed opt-in or rejection', () => {
  window.localStorage.clear();
  const oldFetch = globalThis.fetch;
  const sent: string[] = [];
  globalThis.fetch = ((input: RequestInfo | URL) => { sent.push(String(input)); return Promise.resolve(new Response(null, { status: 204 })); }) as typeof fetch;
  try {
    trackEvent('page_view');
    window.localStorage.setItem(PRIVACY_PREFERENCES_KEY, JSON.stringify({ necessary: true, analytics: true, savedAt: '', version: 1 }));
    trackEvent('page_view');
    assert.equal(savePrivacyPreferences(true), null);
    trackEvent('page_view');
    assert.ok(savePrivacyPreferences(false));
    trackEvent('page_view');
    assert.deepEqual(sent, []);
  } finally { globalThis.fetch = oldFetch; }
});

test('a failed save is reported and tracking fails closed even with an old allow', () => {
  window.localStorage.clear();
  window.localStorage.setItem(PRIVACY_PREFERENCES_KEY, JSON.stringify({ necessary: true, analytics: true, savedAt: '', version: 1 }));
  const storage = Object.getPrototypeOf(window.localStorage);
  const set = storage.setItem;
  const remove = storage.removeItem;
  storage.setItem = () => { throw new Error('storage denied'); };
  storage.removeItem = () => { throw new Error('storage denied'); };
  const oldFetch = globalThis.fetch;
  let transmissions = 0;
  globalThis.fetch = (() => { transmissions++; return Promise.resolve(new Response(null, { status: 204 })); }) as typeof fetch;
  try {
    assert.equal(hasAnalyticsConsent(), false, 'unwritable storage fails closed before any attempt to save');
    assert.equal(savePrivacyPreferences(false), null, 'failed revocation is not reported as saved');
    assert.equal(hasAnalyticsConsent(), false);
    trackEvent('page_view');
    assert.equal(transmissions, 0);
  } finally {
    storage.setItem = set; storage.removeItem = remove; globalThis.fetch = oldFetch;
  }
  assert.equal(hasAnalyticsConsent(), false, 'fault stays latched until an actual save succeeds');
  assert.ok(savePrivacyPreferences(false));
  assert.equal(hasAnalyticsConsent(), false);
});

test('consent interface remains open and reports a failed save', async () => {
  window.localStorage.clear();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const storage = Object.getPrototypeOf(window.localStorage);
  const set = storage.setItem;
  try {
    await act(async () => { root.render(createElement(CookieConsent)); });
    const reject = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Reject optional');
    assert.ok(reject);
    storage.setItem = () => { throw new Error('storage denied'); };
    await act(async () => { reject.click(); });
    assert.match(container.querySelector('[role="alert"]')?.textContent || '', /could not be saved/);
    assert.match(container.querySelector('[role="alert"]')?.textContent || '', /optional analytics are disabled/i);
    assert.ok(container.textContent?.includes('Reject optional'), 'choice stays open after failure');
    assert.equal(hasAnalyticsConsent(), false);
  } finally {
    storage.setItem = set;
    await act(async () => { root.unmount(); });
    container.remove();
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    savePrivacyPreferences(false);
  }
});

test('customize and settings remain available and publish only a saved choice', async () => {
  window.localStorage.clear();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const previousCustomEvent = globalThis.CustomEvent;
  globalThis.CustomEvent = dom.window.CustomEvent as typeof CustomEvent;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  let changes = 0;
  const onChange = () => { changes++; };
  window.addEventListener('edureach:privacy-preferences-changed', onChange);
  const button = (label: string) => Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label);
  try {
    await act(async () => { root.render(createElement(CookieConsent)); });
    assert.ok(button('Customize'));
    await act(async () => { button('Customize')!.click(); });
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    assert.ok(checkbox);
    assert.equal(checkbox.checked, false);
    assert.equal(checkbox.disabled, true, 'opt-in is unavailable while suspended');
    await act(async () => { checkbox.click(); });
    await act(async () => { button('Save choices')!.click(); });
    assert.equal(readPrivacyPreferences()?.analytics, false);
    assert.equal(changes, 1);
    await act(async () => { button('Cookie settings')!.click(); });
    assert.equal((container.querySelector('input[type="checkbox"]') as HTMLInputElement).checked, false);
  } finally {
    window.removeEventListener('edureach:privacy-preferences-changed', onChange);
    await act(async () => { root.unmount(); });
    container.remove();
    globalThis.CustomEvent = previousCustomEvent;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    savePrivacyPreferences(false);
  }
});
