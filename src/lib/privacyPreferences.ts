// Consent controls adapted from the existing privacy work in PR #32. The stored
// value is deliberately shared with that work so it does not create a second preference.
export const PRIVACY_PREFERENCES_KEY = 'edureach-privacy-preferences-v1';
const STORAGE_PROBE_KEY = 'edureach-privacy-storage-probe';
let storageFault = false;

export type PrivacyPreferences = {
  necessary: true;
  analytics: boolean;
  savedAt: string;
  version: 1;
};

export function readPrivacyPreferences(): PrivacyPreferences | null {
  try {
    const raw = window.localStorage.getItem(PRIVACY_PREFERENCES_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PrivacyPreferences>;
    if (value.version !== 1 || value.necessary !== true || typeof value.analytics !== 'boolean') return null;
    return { necessary: true, analytics: value.analytics, savedAt: typeof value.savedAt === 'string' ? value.savedAt : '', version: 1 };
  } catch {
    return null;
  }
}

/** Null means the preference was not reliably saved; optional tracking stays off. */
export function savePrivacyPreferences(analytics: boolean): PrivacyPreferences | null {
  const value: PrivacyPreferences = { necessary: true, analytics, savedAt: new Date().toISOString(), version: 1 };
  try {
    const encoded = JSON.stringify(value);
    window.localStorage.setItem(PRIVACY_PREFERENCES_KEY, encoded);
    if (window.localStorage.getItem(PRIVACY_PREFERENCES_KEY) !== encoded) throw new Error('Preference did not persist');
    storageFault = false;
    return value;
  } catch {
    storageFault = true;
    // Do not leave a previous or partially saved allow if removal is possible.
    try { window.localStorage.removeItem(PRIVACY_PREFERENCES_KEY); } catch { /* unavailable */ }
    return null;
  }
}

/** Fail closed even when an old allow is readable but storage has become unwritable. */
export function hasAnalyticsConsent(): boolean {
  if (storageFault || readPrivacyPreferences()?.analytics !== true) return false;
  try {
    window.localStorage.setItem(STORAGE_PROBE_KEY, '1');
    if (window.localStorage.getItem(STORAGE_PROBE_KEY) !== '1') return false;
    window.localStorage.removeItem(STORAGE_PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}
