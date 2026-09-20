import { supabase } from './supabase';

export type SavedItemType = 'school' | 'course' | 'service' | 'scholarship' | 'custom';

export type DashboardSavedItem = {
  id: string;
  key: string;
  type: SavedItemType;
  name: string;
  detail: string;
  location?: string;
  href?: string;
  saved: boolean;
  createdAt?: string;
};

export type DashboardSavedItemInput = {
  type: SavedItemType;
  key: string;
  name: string;
  detail?: string;
  location?: string;
  href?: string;
  metadata?: Record<string, unknown>;
};

export type DashboardNotification = {
  id: string;
  title: string;
  body?: string;
  time: string;
  read: boolean;
  type: string;
  href?: string;
  created_at: string;
};

export type CgpaCourseInput = {
  code: string;
  units: number;
  grade: string;
};

export type CgpaSnapshot = {
  id: string;
  termLabel: string;
  gpa: string;
  totalUnits: number;
  classification: string;
  createdAt: string;
  courses: CgpaCourseInput[];
};

const gradePoints: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };

function logOptionalTableError(scope: string, error: unknown) {
  // The dashboard must remain usable if a Supabase project has not run the
  // latest student-portal migration yet. Log for developers; do not block UI.
  console.warn(`[student-dashboard] ${scope}`, error);
}

function timeAgo(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;

  if (Number.isNaN(date.getTime())) return 'Recently';
  if (diffMs < minute) return 'Just now';
  if (diffMs < hour) return `${Math.max(1, Math.round(diffMs / minute))} min ago`;
  if (diffMs < day) return `${Math.round(diffMs / hour)} hours ago`;
  if (diffMs < day * 2) return 'Yesterday';
  if (diffMs < day * 7) return `${Math.round(diffMs / day)} days ago`;
  return new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function calculateCgpa(courses: CgpaCourseInput[]) {
  const totals = courses.reduce(
    (acc, course) => {
      const units = Number(course.units) || 0;
      const points = gradePoints[course.grade] ?? 0;
      acc.units += units;
      acc.points += units * points;
      return acc;
    },
    { units: 0, points: 0 }
  );
  const gpa = totals.units > 0 ? totals.points / totals.units : 0;
  const classification =
    gpa >= 4.5
      ? 'First Class Honours'
      : gpa >= 3.5
      ? 'Second Class Upper (2:1)'
      : gpa >= 2.4
      ? 'Second Class Lower (2:2)'
      : gpa >= 1.5
      ? 'Third Class'
      : 'Probation / Review Required';

  return {
    gpa,
    gpaText: gpa.toFixed(2),
    totalUnits: totals.units,
    classification,
  };
}

export async function fetchSavedItems(userId: string): Promise<DashboardSavedItem[]> {
  const { data, error } = await supabase
    .from('student_saved_items')
    .select('id,item_type,item_key,title,subtitle,detail,location,href,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logOptionalTableError('Unable to load saved items', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: String(row.id),
    key: String(row.item_key || row.id),
    type: row.item_type as SavedItemType,
    name: String(row.title || row.subtitle || 'Saved item'),
    detail: String(row.detail || row.subtitle || ''),
    location: row.location || undefined,
    href: row.href || undefined,
    saved: true,
    createdAt: row.created_at || undefined,
  }));
}

export async function upsertSavedItem(userId: string, input: DashboardSavedItemInput): Promise<DashboardSavedItem | null> {
  const payload = {
    user_id: userId,
    item_type: input.type,
    item_key: input.key,
    title: input.name,
    subtitle: input.detail || null,
    detail: input.detail || null,
    location: input.location || null,
    href: input.href || null,
    metadata: input.metadata || {},
  };

  const { data, error } = await supabase
    .from('student_saved_items')
    .upsert(payload, { onConflict: 'user_id,item_type,item_key' })
    .select('id,item_type,item_key,title,subtitle,detail,location,href,created_at')
    .single();

  if (error) {
    logOptionalTableError('Unable to save item', error);
    return null;
  }

  return {
    id: String(data.id),
    key: String(data.item_key),
    type: data.item_type as SavedItemType,
    name: String(data.title),
    detail: String(data.detail || data.subtitle || ''),
    location: data.location || undefined,
    href: data.href || undefined,
    saved: true,
    createdAt: data.created_at || new Date().toISOString(),
  };
}

export async function deleteSavedItem(id: string) {
  const { error } = await supabase.from('student_saved_items').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchNotifications(userId: string): Promise<DashboardNotification[]> {
  const { data, error } = await supabase
    .from('student_notifications')
    .select('id,title,body,notification_type,href,read_at,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    logOptionalTableError('Unable to load notifications', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: String(row.id),
    title: String(row.title),
    body: row.body || undefined,
    time: timeAgo(String(row.created_at)),
    read: Boolean(row.read_at),
    type: String(row.notification_type || 'system'),
    href: row.href || undefined,
    created_at: String(row.created_at),
  }));
}

export async function createNotification(
  userId: string,
  notification: { title: string; body?: string; type?: string; href?: string; metadata?: Record<string, unknown> }
) {
  const { data, error } = await supabase
    .from('student_notifications')
    .insert({
      user_id: userId,
      title: notification.title,
      body: notification.body || null,
      notification_type: notification.type || 'system',
      href: notification.href || null,
      metadata: notification.metadata || {},
    })
    .select('id,title,body,notification_type,href,read_at,created_at')
    .single();

  if (error) {
    logOptionalTableError('Unable to create notification', error);
    return null;
  }

  return {
    id: String(data.id),
    title: String(data.title),
    body: data.body || undefined,
    time: timeAgo(String(data.created_at)),
    read: Boolean(data.read_at),
    type: String(data.notification_type || 'system'),
    href: data.href || undefined,
    created_at: String(data.created_at),
  } satisfies DashboardNotification;
}

export async function markNotificationsRead(userId: string) {
  const { error } = await supabase
    .from('student_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) throw error;
}

export async function fetchLatestCgpaSnapshot(userId: string): Promise<CgpaSnapshot | null> {
  const { data: term, error: termError } = await supabase
    .from('student_cgpa_terms')
    .select('id,term_label,gpa,total_units,classification,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (termError) {
    logOptionalTableError('Unable to load CGPA term', termError);
    return null;
  }
  if (!term) return null;

  const { data: courses, error: coursesError } = await supabase
    .from('student_cgpa_courses')
    .select('course_code,units,grade')
    .eq('term_id', term.id)
    .order('created_at', { ascending: true });

  if (coursesError) {
    logOptionalTableError('Unable to load CGPA courses', coursesError);
  }

  return {
    id: String(term.id),
    termLabel: String(term.term_label || 'Current Semester'),
    gpa: Number(term.gpa || 0).toFixed(2),
    totalUnits: Number(term.total_units || 0),
    classification: String(term.classification || ''),
    createdAt: String(term.created_at),
    courses: (courses || []).map((course: any) => ({
      code: String(course.course_code),
      units: Number(course.units || 0),
      grade: String(course.grade || 'A'),
    })),
  };
}

export async function saveCgpaSnapshot(userId: string, courses: CgpaCourseInput[]) {
  const normalizedCourses = courses
    .map((course) => ({
      code: course.code.trim().toUpperCase(),
      units: Number(course.units) || 0,
      grade: course.grade || 'A',
    }))
    .filter((course) => course.code && course.units > 0);

  const cgpa = calculateCgpa(normalizedCourses);
  const { data: term, error: termError } = await supabase
    .from('student_cgpa_terms')
    .insert({
      user_id: userId,
      term_label: 'Current Semester',
      gpa: Number(cgpa.gpaText),
      total_units: cgpa.totalUnits,
      classification: cgpa.classification,
    })
    .select('id,term_label,gpa,total_units,classification,created_at')
    .single();

  if (termError) throw termError;

  if (normalizedCourses.length) {
    const { error: coursesError } = await supabase.from('student_cgpa_courses').insert(
      normalizedCourses.map((course) => ({
        term_id: term.id,
        user_id: userId,
        course_code: course.code,
        units: course.units,
        grade: course.grade,
        grade_points: gradePoints[course.grade] ?? 0,
      }))
    );
    if (coursesError) throw coursesError;
  }

  return {
    id: String(term.id),
    termLabel: String(term.term_label || 'Current Semester'),
    gpa: Number(term.gpa || 0).toFixed(2),
    totalUnits: Number(term.total_units || 0),
    classification: String(term.classification || cgpa.classification),
    createdAt: String(term.created_at),
    courses: normalizedCourses,
  } satisfies CgpaSnapshot;
}

export async function recordSecurityEvent(userId: string, eventType: string, eventLabel: string, metadata: Record<string, unknown> = {}) {
  const { error } = await supabase.from('student_security_events').insert({
    user_id: userId,
    event_type: eventType,
    event_label: eventLabel,
    metadata,
  });
  if (error) logOptionalTableError('Unable to record security event', error);
}
