/**
 * Local-only storage is a preview fallback, not an authentication provider.
 * Keep its records separated by the email entered for the current preview
 * session so switching local accounts on the same device cannot expose the
 * previous student's saved requests, results, or profile.
 */
export function localStorageKey(name: string): string {
  let email = '';
  try {
    email = localStorage.getItem('edureach-local-user-email')?.trim().toLowerCase() || '';
  } catch {
    // storage unavailable
  }
  const scope = email ? email.replace(/[^a-z0-9]+/g, '-') : 'anonymous';
  return `edureach-local:${scope}:${name}`;
}

/** Read a migrated profile while still accepting the pre-scoped preview key. */
export function readLocalPreviewValue(name: string): string | null {
  try {
    const scoped = localStorage.getItem(localStorageKey(name));
    if (scoped !== null) return scoped;
    if (name !== 'profile') return null;

    const legacy = localStorage.getItem('edureach-student-profile');
    if (!legacy) return null;
    const parsed = JSON.parse(legacy) as { email?: string };
    const currentEmail = localStorage.getItem('edureach-local-user-email')?.trim().toLowerCase();
    if (parsed?.email && currentEmail && parsed.email.trim().toLowerCase() === currentEmail) return legacy;
  } catch {
    // storage unavailable or malformed legacy data
  }
  return null;
}
