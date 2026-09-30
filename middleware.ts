/**
 * Express authorization guards. The logic lives in lib/authorization.ts so the
 * capability model has one implementation; this file only re-exports it under
 * the names the server imports.
 *
 * `requireAdmin` is kept as an alias of `requireStaff` for the two endpoints
 * that are deliberately "any staff member" surfaces (`/api/admin/session` and
 * `/api/admin/session/verify`). Every other admin route names the capability it
 * needs with `requireCapability(...)`.
 */

export {
  authenticateRequest,
  can,
  assertOwnership,
  hasAnyCapability,
  hasCapability,
  recordAudit,
  requireCapability,
  requireStaff,
  FORBIDDEN_MESSAGE,
  type AuthorizedRequest,
  type OwnedResource,
} from './lib/authorization';

export { requireStaff as requireAdmin } from './lib/authorization';
export type { AuthorizedRequest as AdminRequest } from './lib/authorization';
