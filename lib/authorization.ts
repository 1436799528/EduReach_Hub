/**
 * Server-side authorization: one place that turns a validated session into a
 * allow/deny decision.
 *
 *   capability check      hasCapability / hasAnyCapability / can
 *   ownership check       can(user, capability, { ownerId }) / assertOwnership
 *   express middleware    requireStaff / requireCapability
 *   audit trail           recordAudit
 *
 * Rules that must not be relaxed (docs/features/ROLE-1.md, §Security):
 *  - the caller is resolved from the bearer token and the trusted profile row;
 *  - a missing capability is 403 with a generic message — never a hint about
 *    which role would have been allowed;
 *  - ownership failures are reported as 404 so resource existence is not leaked;
 *  - the service-role database client is only used after authorization.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { extractBearerToken, verifyJWT, type UserPayload } from './auth';
import {
  hasAnyCapability as holderHasAnyCapability,
  hasCapability as holderHasCapability,
  OWNER_SCOPED_CAPABILITIES,
  type Capability,
} from '../src/lib/capabilities';

export type AuthorizedRequest = Request & {
  /** Set by the guards below for every authenticated request. */
  authUser?: UserPayload;
  /** Retained name used across the existing admin handlers. */
  adminUser?: UserPayload;
};

export interface OwnedResource {
  ownerId?: string | null;
}

export const FORBIDDEN_MESSAGE = 'You do not have permission to perform this action.';

const OWNER_SCOPED = new Set<string>(OWNER_SCOPED_CAPABILITIES);

export function hasCapability(user: UserPayload | null | undefined, capability: Capability): boolean {
  return holderHasCapability(user, capability);
}

export function hasAnyCapability(user: UserPayload | null | undefined, capabilities: readonly Capability[]): boolean {
  return holderHasAnyCapability(user, capabilities);
}

/**
 * Capability **and** ownership. Owner-scoped capabilities require a matching
 * owner and are never satisfied by a staff role, so an administrator reads
 * another student's data through a staff capability (`cbt.read`,
 * `service_request.read`) rather than by impersonating ownership.
 */
export function can(user: UserPayload | null | undefined, capability: Capability, resource?: OwnedResource): boolean {
  if (!hasCapability(user, capability)) return false;
  if (!OWNER_SCOPED.has(capability)) return true;
  if (!resource || resource.ownerId === undefined || resource.ownerId === null) return false;
  return String(resource.ownerId) === String(user?.id);
}

/** Convenience for handlers that already loaded the row. */
export function assertOwnership(user: UserPayload | null | undefined, capability: Capability, ownerId: string | null | undefined): boolean {
  return can(user, capability, { ownerId });
}

async function resolveCaller(token: string | null): Promise<UserPayload | null> {
  if (!token) return null;
  try {
    return await verifyJWT(token);
  } catch (error) {
    console.error('Authorization error:', error);
    return null;
  }
}

/** Attach the resolved caller without deciding anything. Used by the guards. */
export async function authenticateRequest(req: Request): Promise<UserPayload | null> {
  const token = extractBearerToken(req.header('authorization'));
  const user = await resolveCaller(token);
  if (user) (req as AuthorizedRequest).authUser = user;
  return user;
}

function deny(res: Response, status: 401 | 403, message: string) {
  return res.status(status).json({ error: message });
}

/** Authenticated staff (holds at least one capability beyond the student set). */
export async function requireStaff(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.header('authorization'));
  if (!token) return deny(res, 401, 'Authentication required.');

  const user = await resolveCaller(token);
  if (!user) return deny(res, 401, 'Invalid or expired session.');

  const staffCapabilities = user.capabilities.filter((capability) => !OWNER_SCOPED.has(capability));
  if (staffCapabilities.length === 0) return deny(res, 403, FORBIDDEN_MESSAGE);

  const authorized = req as AuthorizedRequest;
  authorized.authUser = user;
  authorized.adminUser = user;
  return next();
}

/**
 * Requires **any** of the listed capabilities. Attaches its requirements to the
 * returned handler so tests can prove every privileged route carries one
 * (tests/authorization.test.ts).
 */
export function requireCapability(...capabilities: Capability[]): RequestHandler {
  const handler = async (req: Request, res: Response, next: NextFunction) => {
    const token = extractBearerToken(req.header('authorization'));
    if (!token) return deny(res, 401, 'Authentication required.');

    const user = await resolveCaller(token);
    if (!user) return deny(res, 401, 'Invalid or expired session.');

    if (!hasAnyCapability(user, capabilities)) return deny(res, 403, FORBIDDEN_MESSAGE);

    const authorized = req as AuthorizedRequest;
    authorized.authUser = user;
    authorized.adminUser = user;
    return next();
  };

  (handler as RequestHandler & { capabilities?: readonly Capability[] }).capabilities = capabilities;
  return handler;
}

/**
 * The audit trail. Never throws: an audit write must not turn a successful
 * operation into a failed one, and a missing RPC must not break a deployment.
 */
export async function recordAudit(
  // Supabase's rpc() returns a thenable builder rather than a promise.
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ error?: unknown }> },
  entry: {
    actorId: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
    result?: 'success' | 'failure';
  },
): Promise<void> {
  try {
    const { error } = await Promise.resolve(supabase.rpc('admin_audit_log', {
      p_admin_user_id: entry.actorId,
      p_action: entry.action,
      p_entity_type: entry.resourceType,
      p_entity_id: entry.resourceId ?? null,
      p_metadata: { ...(entry.metadata || {}), result: entry.result || 'success' },
    }));
    if (error) console.error('Audit log write failed:', error);
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}
