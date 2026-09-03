import { supabase, isValidUuid } from './supabase';

const requireClient = () => {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
};

export type BookmarkEntity = 'resource' | 'past_question' | 'campus_post';

export async function addBookmark(userId: string, entityType: BookmarkEntity, entityId: string) {
  if (!isValidUuid(userId)) return null;
  const { data, error } = await requireClient()
    .from('edureach_bookmarks')
    .insert({ user_id: userId, entity_type: entityType, entity_id: entityId })
    .select('id,user_id,entity_type,entity_id,created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function removeBookmark(userId: string, entityType: BookmarkEntity, entityId: string) {
  if (!isValidUuid(userId)) return;
  const { error } = await requireClient()
    .from('edureach_bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
  if (error) throw error;
}

export async function isBookmarked(userId: string, entityType: BookmarkEntity, entityId: string) {
  if (!isValidUuid(userId)) return false;
  const { data, error } = await requireClient()
    .from('edureach_bookmarks')
    .select('id')
    .eq('user_id', userId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function toggleBookmark(userId: string, entityType: BookmarkEntity, entityId: string) {
  if (!isValidUuid(userId)) return false;
  return (await isBookmarked(userId, entityType, entityId))
    ? (await removeBookmark(userId, entityType, entityId), false)
    : (await addBookmark(userId, entityType, entityId), true);
}

export async function listBookmarks(userId: string, entityType?: BookmarkEntity) {
  if (!isValidUuid(userId)) return [];
  let query = requireClient()
    .from('edureach_bookmarks')
    .select('id,user_id,entity_type,entity_id,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (entityType) query = query.eq('entity_type', entityType);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listMyNotifications(userId: string, limit = 30) {
  if (!isValidUuid(userId)) return [];
  const { data, error } = await requireClient()
    .from('edureach_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(userId: string, notificationId: string) {
  if (!isValidUuid(userId) || !isValidUuid(notificationId)) return;
  const { error } = await requireClient()
    .from('edureach_notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string) {
  if (!isValidUuid(userId)) return;
  const { error } = await requireClient()
    .from('edureach_notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

export async function logSearchQuery(userId: string, query: string, filters: Record<string, unknown> = {}) {
  const value = query.trim();
  if (!value || !isValidUuid(userId)) return;
  const { error } = await requireClient().from('edureach_search_queries').insert({
    user_id: userId,
    query: value.slice(0, 200),
    filters,
  });
  if (error) throw error;
}

export async function syncMaterialNoteToBackend(userId: string, note: {
  id: string;
  materialId: string;
  courseCode: string;
  materialTitle: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}) {
  if (!supabase || !isValidUuid(userId)) return null;
  try {
    const { data, error } = await supabase
      .from('edureach_material_notes')
      .upsert({
        id: note.id,
        user_id: userId,
        material_id: note.materialId,
        course_code: note.courseCode,
        material_title: note.materialTitle,
        content: note.content,
        created_at: note.createdAt,
        updated_at: note.updatedAt || new Date().toISOString(),
      })
      .select('*')
      .maybeSingle();

    if (error) {
      console.warn('Backend note sync failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('Backend note sync error:', err);
    return null;
  }
}

export async function deleteMaterialNoteFromBackend(userId: string, noteId: string) {
  if (!supabase || !isValidUuid(userId)) return false;
  try {
    const { error } = await supabase
      .from('edureach_material_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}

export async function listMaterialNotesFromBackend(userId: string, materialId?: string) {
  if (!supabase || !isValidUuid(userId)) return [];
  try {
    let query = supabase
      .from('edureach_material_notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (materialId) {
      query = query.eq('material_id', materialId);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('Failed to load notes from Supabase:', error.message);
      return [];
    }
    return data ?? [];
  } catch {
    return [];
  }
}


