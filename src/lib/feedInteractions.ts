import { supabase, isValidUuid } from './supabase';

const requireClient = () => {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
};

export async function togglePostLike(postId: string, userId: string) {
  if (!isValidUuid(userId)) return { liked: false };
  const client = requireClient();
  const { data: existing, error: lookupError } = await client
    .from('campus_post_likes')
    .select('post_id,user_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing) {
    const { error } = await client
      .from('campus_post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
    return { liked: false };
  }

  const { error } = await client
    .from('campus_post_likes')
    .insert({ post_id: postId, user_id: userId });
  if (error) throw error;
  return { liked: true };
}

export async function addPostComment(postId: string, userId: string, body: string) {
  const text = body.trim();
  if (!text) throw new Error('Comment cannot be empty.');
  if (!isValidUuid(userId)) throw new Error('Please sign in with a verified account to comment.');

  const { data, error } = await requireClient()
    .from('campus_post_comments')
    .insert({ post_id: postId, author_id: userId, body: text })
    .select('id,post_id,author_id,body,created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function getPostComments(postId: string) {
  const client = requireClient();
  const { data, error } = await client
    .from('campus_post_comments')
    .select('id,post_id,author_id,body,created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getPostLikeState(postId: string, userId: string) {
  if (!isValidUuid(userId)) return false;
  const { data, error } = await requireClient()
    .from('campus_post_likes')
    .select('post_id,user_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

