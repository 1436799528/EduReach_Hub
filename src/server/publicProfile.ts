import { PUBLIC_PROFILE_SELECT, projectPublicProfile, type PublicProfileRow } from '../lib/publicProfile';

export { PUBLIC_PROFILE_SELECT };

export type PublicProfileRecord = PublicProfileRow & { id?: string | null };

/**
 * The single place the API decides what a visitor may see. Keeping it a pure
 * function means the tests can pass a row containing every private column and
 * assert that none of it survives.
 */
export function publicProfileResponse(row: PublicProfileRecord, emailVerified: boolean) {
  return projectPublicProfile(row, emailVerified);
}
