/**
 * The capability vocabulary — one place that answers "what may this account do?"
 *
 * Authorization is expressed as `resource.action` capabilities rather than role
 * names, so an endpoint declares what it needs instead of hard-coding who may
 * call it, and a new role is a change to ROLE_CAPABILITIES rather than a change
 * to every call site.
 *
 * This module is intentionally dependency-free: it is imported by the Express
 * server, by the browser console and by the tests, so there is exactly one
 * vocabulary. It is the ONLY place capabilities are defined — see
 * docs/features/ROLE-1.md for the role → capability mapping and why the mapping
 * lives in code rather than in database tables.
 */

export const CAPABILITIES = [
  // Student surfaces. These are owner-scoped: holding the capability means
  // "may act on my own rows", never on someone else's (see OWNER_SCOPED).
  'profile.read',
  'profile.update',
  'dashboard.access',
  'settings.read',
  'settings.update',
  'service_request.create',
  'service_request.read_own',
  'cbt.attempt',
  'cbt.view_result',

  // Newsroom and editorial content.
  'news.read',
  'news.create',
  'news.update',
  'news.publish',
  'news.delete',

  // Opportunities (scholarships, grants, jobs).
  'opportunity.read',
  'opportunity.create',
  'opportunity.update',
  'opportunity.delete',

  // Institutions and the academic catalogue.
  'institution.read',
  'institution.create',
  'institution.update',
  'institution.delete',

  // Calendar items (events, deadlines, key dates).
  'calendar.read',
  'calendar.create',
  'calendar.update',
  'calendar.delete',

  // The public service catalogue (service_catalog rows).
  'service.read',
  'service.create',
  'service.update',
  'service.delete',

  // Student service requests — operational data containing personal details.
  // Read and process are separate so a content editor can never see them.
  'service_request.read',
  'service_request.process',

  // CBT administration. `cbt.read` includes question banks and answer keys,
  // which is why it is a staff capability distinct from `cbt.attempt`.
  'cbt.read',
  'cbt.manage',

  // Product analytics and the admin audit trail.
  'analytics.read',
  'audit.read',

  // Bulk data control (Content Manager resources and imports).
  'data.read',
  'data.write',
  'data.import',

  // Account administration.
  'user.read',
  'user.suspend',
  'user.manage_roles',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** Application roles. The database stores one of these in `profiles.role`. */
export type AppRole = 'student' | 'content_editor' | 'service_admin' | 'super_admin';

/**
 * Capabilities that only ever apply to rows the caller owns. `can()` refuses
 * them without an owning resource, and refuses a mismatch even for a super
 * admin — staff read other people's data through staff capabilities
 * (`cbt.read`, `service_request.read`), never by impersonating an owner.
 */
export const OWNER_SCOPED_CAPABILITIES: readonly Capability[] = [
  'profile.read',
  'profile.update',
  'dashboard.access',
  'settings.read',
  'settings.update',
  'service_request.create',
  'service_request.read_own',
  'cbt.attempt',
  'cbt.view_result',
];

const STUDENT_CAPABILITIES: readonly Capability[] = [
  'profile.read',
  'profile.update',
  'dashboard.access',
  'settings.read',
  'settings.update',
  'service_request.create',
  'service_request.read_own',
  'cbt.attempt',
  'cbt.view_result',
];

const CONTENT_EDITOR_CAPABILITIES: readonly Capability[] = [
  'news.read',
  'news.create',
  'news.update',
  'news.publish',
  'news.delete',
  'opportunity.read',
  'opportunity.create',
  'opportunity.update',
  'opportunity.delete',
  'institution.read',
  'institution.create',
  'institution.update',
  'institution.delete',
  'calendar.read',
  'calendar.create',
  'calendar.update',
  'calendar.delete',
  'service.read',
  'service.create',
  'service.update',
  'service.delete',
  'cbt.read',
  'cbt.manage',
  'analytics.read',
  'data.read',
];

const SERVICE_ADMIN_CAPABILITIES: readonly Capability[] = [
  'service.read',
  'service_request.read',
  'service_request.process',
];

/**
 * Every role also holds the student capabilities, because a staff member is
 * still a signed-in person who may use the student dashboard. The student
 * capabilities stay owner-scoped, so this grants no access to another
 * student's data.
 */
export const ROLE_CAPABILITIES: Record<AppRole, readonly Capability[]> = {
  student: STUDENT_CAPABILITIES,
  content_editor: [...STUDENT_CAPABILITIES, ...CONTENT_EDITOR_CAPABILITIES],
  service_admin: [...STUDENT_CAPABILITIES, ...SERVICE_ADMIN_CAPABILITIES],
  super_admin: [...CAPABILITIES],
};

/**
 * Legacy database role values.
 *
 *  - `admin` and `moderator` predate this vocabulary. They are mapped to
 *    `super_admin` so that existing staff accounts keep exactly the access they
 *    have today; the migration normalises the stored values.
 *  - `senate_admin` and `campus_agent` are RETIRED (decision D1). They could
 *    read staff-scoped rows through RLS while never passing the admin gate, so
 *    they are treated as students: no staff capability, no staff data.
 */
const LEGACY_SUPER_ADMIN_ROLES = new Set(['admin', 'moderator', 'super_admin']);
export const RETIRED_STAFF_ROLES = new Set(['senate_admin', 'campus_agent']);

/** True when a raw database role belongs to the retired half-role vocabulary. */
export function isRetiredStaffRole(rawRole: unknown): boolean {
  return RETIRED_STAFF_ROLES.has(String(rawRole ?? '').trim().toLowerCase());
}

/**
 * Map a `profiles.role` value to an application role. Unknown values resolve to
 * `student` — least privilege, and never an accidental staff grant.
 */
export function resolveAppRole(rawRole: unknown): AppRole {
  const value = String(rawRole ?? '').trim().toLowerCase();
  if (value === 'content_editor') return 'content_editor';
  if (value === 'service_admin') return 'service_admin';
  if (LEGACY_SUPER_ADMIN_ROLES.has(value)) return 'super_admin';
  return 'student';
}

export function capabilitiesForRole(role: AppRole): readonly Capability[] {
  return ROLE_CAPABILITIES[role] || STUDENT_CAPABILITIES;
}

/** Anything with a capability beyond the student set is staff. */
export function isStaffRole(role: AppRole): boolean {
  return role !== 'student';
}

export interface CapabilityHolder {
  role?: unknown;
  capabilities?: readonly string[] | null;
}

/**
 * Client and server both ask this question. A server-resolved user carries an
 * explicit capability list; anything else falls back to resolving its role.
 */
export function hasCapability(user: CapabilityHolder | null | undefined, capability: Capability): boolean {
  if (!user) return false;
  if (Array.isArray(user.capabilities)) return user.capabilities.includes(capability);
  return capabilitiesForRole(resolveAppRole(user.role)).includes(capability);
}

export function hasAnyCapability(user: CapabilityHolder | null | undefined, capabilities: readonly Capability[]): boolean {
  return capabilities.some((capability) => hasCapability(user, capability));
}

/**
 * Console sections and the capability each needs. Used to render navigation and
 * to refuse a deep link in the UI — the server enforces the same rule, and the
 * server is the boundary.
 */
export const ADMIN_ROUTE_CAPABILITIES: ReadonlyArray<{ path: string; capability: Capability }> = [
  { path: '/admin/news', capability: 'news.read' },
  { path: '/admin/content', capability: 'calendar.read' },
  { path: '/admin/opportunities', capability: 'opportunity.read' },
  { path: '/admin/services', capability: 'service.read' },
  { path: '/admin/queue', capability: 'service_request.read' },
  { path: '/admin/schools', capability: 'institution.read' },
  { path: '/admin/cbt', capability: 'cbt.read' },
  { path: '/admin/users', capability: 'user.read' },
  { path: '/admin/analytics', capability: 'analytics.read' },
  { path: '/admin/content-manager', capability: 'data.read' },
];

/**
 * The capability a console path needs, or null when any staff member may open
 * it (`/admin` overview and `/admin/health` style surfaces).
 */
export function capabilityForAdminPath(pathname: string): Capability | null {
  const path = String(pathname || '/').split('?')[0].replace(/\/+$/, '') || '/';
  const match = ADMIN_ROUTE_CAPABILITIES.find((entry) => path === entry.path || path.startsWith(`${entry.path}/`));
  return match ? match.capability : null;
}
