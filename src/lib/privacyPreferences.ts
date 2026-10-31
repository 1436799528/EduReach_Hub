export const PRIVACY_PREFERENCES_KEY = 'edureach-privacy-preferences-v1';

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
    return {
      necessary: true,
      analytics: value.analytics,
      savedAt: typeof value.savedAt === 'string' ? value.savedAt : '',
      version: 1,
    };
  } catch {
    return null;
  }
}

export function savePrivacyPreferences(analytics: boolean): PrivacyPreferences {
  const value: PrivacyPreferences = {
    necessary: true,
    analytics,
    savedAt: new Date().toISOString(),
    version: 1,
  };
  try {
    window.localStorage.setItem(PRIVACY_PREFERENCES_KEY, JSON.stringify(value));
  } catch {
    // If storage is unavailable, do not silently enable optional analytics.
  }
  return value;
}

export function hasAnalyticsConsent(): boolean {
  return readPrivacyPreferences()?.analytics === true;
}
