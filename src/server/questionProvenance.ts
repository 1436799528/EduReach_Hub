/**
 * Refusal mapping for the question-provenance guard.
 *
 * The authority is the database trigger in
 * `supabase/candidates/restricted_question_provenance_candidate.sql`. It raises
 *
 *   errcode = '42501'
 *   message = 'This question text already exists in a restricted bank. It
 *              cannot be added to a public or unclassified bank.'
 *   detail  = 'cbt_question_provenance_guard'
 *
 * `42501` on its own is *not* evidence: permission denials, the import
 * bank-move guard and the restricted-bank classification gate all use the same
 * SQLSTATE. A refusal is therefore only recognised when the SQLSTATE matches and
 * either the guard's machine-readable `detail` marker or its exact sentence is
 * present. `tests/question-provenance-refusal.test.ts` re-reads the candidate SQL
 * and fails if these constants drift from what the database actually raises.
 *
 * Nothing here inspects, logs or returns question text, fingerprints, bank
 * titles or raw database errors.
 */

/** Machine-readable marker set in the trigger's `DETAIL`. */
export const PROVENANCE_GUARD_DETAIL = 'cbt_question_provenance_guard';

/** The exact sentence the trigger raises, including its trailing period. */
export const PROVENANCE_GUARD_MESSAGE =
  'This question text already exists in a restricted bank. It cannot be added to a public or unclassified bank.';

/** SQLSTATE used by the guard. Ambiguous alone; see above. */
export const PROVENANCE_GUARD_SQLSTATE = '42501';

/** Stable client-facing code for a refused question create/update. */
export const QUESTION_PROVENANCE_REFUSED = 'question_provenance_refused';
/** Stable client-facing code for a refused import publication. */
export const QUESTION_IMPORT_PROVENANCE_REFUSED = 'question_import_provenance_refused';

/** Operator-facing text for the question routes. Names no bank or question. */
export const QUESTION_PROVENANCE_MESSAGE =
  'This question text already exists in a restricted bank, so it cannot be added to a public or unclassified bank.';

/** Operator-facing text for the import publisher. Names no bank or question. */
export const QUESTION_IMPORT_PROVENANCE_MESSAGE =
  'This batch contains question text that already exists in a restricted bank. Nothing was saved.';

type DbErrorLike = { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };

function asErrorLike(error: unknown): DbErrorLike | null {
  if (!error || typeof error !== 'object') return null;
  return error as DbErrorLike;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Message of a Supabase/PostgREST error or an `Error`. Never throws. */
export function databaseErrorMessage(error: unknown): string {
  const like = asErrorLike(error);
  if (like) {
    const message = text(like.message);
    if (message) return message;
  }
  return error instanceof Error ? error.message : '';
}

/** SQLSTATE / PostgREST code of a database error. */
export function databaseErrorCode(error: unknown): string {
  const like = asErrorLike(error);
  return like ? text(like.code) : '';
}

/** `DETAIL` of a PostgreSQL error, as surfaced by PostgREST. */
export function databaseErrorDetail(error: unknown): string {
  const like = asErrorLike(error);
  return like ? text(like.details) : '';
}

/**
 * True only for the provenance guard's refusal. Every other database error -
 * permission denials, unique/constraint violations, the import move guard, a
 * missing candidate schema or an unclassified bank - returns false and keeps the
 * handling it had before.
 */
export function isProvenanceGuardRefusal(error: unknown): boolean {
  if (databaseErrorCode(error) !== PROVENANCE_GUARD_SQLSTATE) return false;
  if (databaseErrorDetail(error).trim() === PROVENANCE_GUARD_DETAIL) return true;
  return databaseErrorMessage(error).includes(PROVENANCE_GUARD_MESSAGE);
}

/**
 * True when the database does not carry the reviewed provenance change at all.
 * Callers must fail closed: such an error is infrastructure, never a refusal.
 */
export function isProvenanceGuardUnavailable(error: unknown): boolean {
  const code = databaseErrorCode(error);
  if (code === '42883' || code === '42P01' || code === 'PGRST202' || code === 'PGRST205') return true;
  return /could not find the function|does not exist|schema cache/i.test(databaseErrorMessage(error));
}

/** JSON body for a refused create/update. Contains no database or bank detail. */
export function questionProvenanceRefusal() {
  return { error: QUESTION_PROVENANCE_MESSAGE, code: QUESTION_PROVENANCE_REFUSED };
}

/** JSON body for a refused import publication. */
export function questionImportProvenanceRefusal() {
  return { error: QUESTION_IMPORT_PROVENANCE_MESSAGE, code: QUESTION_IMPORT_PROVENANCE_REFUSED };
}
