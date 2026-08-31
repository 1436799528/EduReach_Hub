import { supabase } from './supabase';

const requireClient = () => {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
};

export type BookmarkEntity = 'resource' | 'past_question' | 'campus_post';

export async function addBookmark(userId: string, entityType: BookmarkEntity, entityId: string) {
  const { data, error } = await requireClient()
    .from('edureach_bookmarks')
    .insert({ user_id: userId, entity_type: entityType, entity_id: entityId })
    .select('id,user_id,entity_type,entity_id,created_at')
    .single();
  if (error) throw error;
  return data;
}

export async function removeBookmark(userId: string, entityType: BookmarkEntity, entityId: string) {
  const { error } = await requireClient()
    .from('edureach_bookmarks')
    .delete()
    .eq('user_id', userId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);
  if (error) throw error;
}

export async function listBookmarks(userId: string, entityType?: BookmarkEntity) {
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
  const { error } = await requireClient()
    .from('edureach_notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function logSearchQuery(userId: string, query: string, filters: Record<string, unknown> = {}) {
  const value = query.trim();
  if (!value) return;
  const { error } = await requireClient().from('edureach_search_queries').insert({
    user_id: userId,
    query: value,
    filters,
  });
  if (error) throw error;
}
