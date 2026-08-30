import type { InstitutionId, UserProfile } from '../types';

export interface SupabaseProfileRow {
  id: string;
  full_name: string;
  email?: string | null;
  school?: string | null;
  faculty?: string | null;
  department?: string | null;
  level?: string | null;
  session?: string | null;
  institution_id?: string | null;
  matric_number?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  institutions?: { acronym?: string | null } | null;
}

const toInstitutionId = (value?: string | null): InstitutionId =>
  (value && ['UNICAL','UNILAG','UI','ABU','UNN','OAU','FUTO','UNIBEN','LASU','DELSU','ALL'].includes(value)
    ? value
    : 'UNICAL') as InstitutionId;

/** Keeps database details isolated from the existing UI UserProfile contract. */
export const mapSupabaseProfileToUserProfile = (row: SupabaseProfileRow, email?: string | null): UserProfile => ({
  id: row.id,
  name: row.full_name,
  email: email ?? row.email ?? '',
  phoneNumber: '',
  institutionId: toInstitutionId(row.institutions?.acronym),
  department: row.department ?? '',
  faculty: row.faculty ?? '',
  level: row.level ?? '',
  walletBalance: 0,
  isAPlusSubscriber: false,
  enrolledCourses: [],
  unlockedMaterialIds: [],
  savedOfflineMaterialIds: [],
  viewHistory: [],
  downloadHistory: [],
  contributorStats: { totalEarned: 0, totalRoyaltyPaid: 0, materialsUploaded: 0, pendingPayout: 0 },
  role: row.role === 'senate_admin' ? 'senate_admin' : row.role === 'moderator' ? 'moderator' : row.role === 'contributor' ? 'contributor' : row.role === 'campus_agent' ? 'campus_agent' : 'student',
});
