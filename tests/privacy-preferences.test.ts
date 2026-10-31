import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  PRIVACY_PREFERENCES_KEY,
  hasAnalyticsConsent,
  readPrivacyPreferences,
  savePrivacyPreferences,
} from '../src/lib/privacyPreferences';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://edureachhub.netlify.app' });
Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });

test('optional analytics are denied when no preference has been saved', () => {
  window.localStorage.clear();
  assert.equal(readPrivacyPreferences(), null);
  assert.equal(hasAnalyticsConsent(), false);
});

test('saving reject keeps necessary storage and disables analytics', () => {
  const saved = savePrivacyPreferences(false);
  assert.equal(saved.necessary, true);
  assert.equal(saved.analytics, false);
  assert.equal(hasAnalyticsConsent(), false);
});

test('analytics are enabled only after an explicit allow choice', () => {
  savePrivacyPreferences(true);
  assert.equal(hasAnalyticsConsent(), true);
  assert.equal(readPrivacyPreferences()?.version, 1);
});

test('malformed or unknown preference versions fail closed', () => {
  window.localStorage.setItem(PRIVACY_PREFERENCES_KEY, JSON.stringify({ version: 99, necessary: true, analytics: true }));
  assert.equal(readPrivacyPreferences(), null);
  assert.equal(hasAnalyticsConsent(), false);
});
