import { resolveAppRole, type AppRole } from './capabilities';

/**
 * ROLE-2 — one presentation vocabulary for role marks.
 *
 * The server resolves powers through `capabilities.ts`; this module only says
 * how a resolved role is named and coloured in a profile. Students keep the
 * general green verified mark and no extra chip. Staff roles add a labelled
 * mark after the check: admin gold, editorial blue and service teal.
 */
export type RolePresentation = {
  role: AppRole;
  label: string;
  color: string;
  surface: string;
  border: string;
  description: string;
};

export const APP_ROLES: readonly AppRole[] = ['student', 'content_editor', 'service_admin', 'super_admin'];

export const ROLE_PRESENTATIONS: Record<AppRole, RolePresentation> = {
  student: {
    role: 'student',
    label: 'Student',
    color: '#15803d',
    surface: '#f0fdf4',
    border: '#86efac',
    description: 'Own profile, practice and requests.',
  },
  content_editor: {
    role: 'content_editor',
    label: 'Content editor',
    color: '#1d4ed8',
    surface: '#eff6ff',
    border: '#93c5fd',
    description: 'News, opportunities, institutions, services and CBT.',
  },
  service_admin: {
    role: 'service_admin',
    label: 'Service admin',
    color: '#0f766e',
    surface: '#f0fdfa',
    border: '#5eead4',
    description: 'Service requests and the catalogue.',
  },
  super_admin: {
    role: 'super_admin',
    label: 'Admin',
    color: '#8a5a00',
    surface: '#fff8e1',
    border: '#e0b341',
    description: 'All capabilities, staff roles and account deletion.',
  },
};

/** Accept a stored role, a legacy spelling, or a human label from an API. */
export function rolePresentation(rawRole: unknown): RolePresentation {
  const value = String(rawRole ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  const appRole = value === 'editor' ? 'content_editor'
    : value === 'service' ? 'service_admin'
      : value === 'administrator' || value === 'super_admin_label' ? 'super_admin'
        : resolveAppRole(value);
  return ROLE_PRESENTATIONS[appRole] || ROLE_PRESENTATIONS.student;
}
