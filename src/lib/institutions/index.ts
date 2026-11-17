/**
 * Institution intelligence — the public surface of the module.
 *
 * Import from here, not from the individual files, so the data-access boundary
 * stays a boundary: a page that reaches past this barrel and queries
 * `supabase.from('institutions')` directly is a page that will miss the alias
 * resolution, the ownership rules and the deployment gate.
 */

export * from './types';
export * from './normalizers';
export * from './aliases';
export * from './mappers';
export * from './selectors';
export * from './repository';
export * from './admissionSelection';
export * from './profileInstitution';
