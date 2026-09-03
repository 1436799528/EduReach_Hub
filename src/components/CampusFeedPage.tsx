import React, { useMemo, useState } from 'react';
import { FeedPost, InstitutionId } from '../types';
import { INSTITUTIONS } from '../data/mockData';
import { addPostComment, togglePostLike } from '../lib/feedInteractions';
import { createCampusUpload, resolveCourseUuid, resolveInstitutionUuid } from '../lib/productionActions';
import {
  BookOpen,
  Building2,
  FileText,
  Heart,
  MessageCircle,
  Search,
  Send,
  Share2,
  UploadCloud,
  X,
} from 'lucide-react';

interface CampusFeedPageProps {
  posts: FeedPost[];
  currentInstitution: InstitutionId;
  userProfile?: {
    id: string;
    name: string;
    department?: string;
    level?: string;
    institutionId?: InstitutionId;
  };
  onSelectMaterialToRead?: (materialTitle: string) => void;
  onOpenAuth?: () => void;
  isLoggedIn?: boolean;
}

const categories = [
  { id: 'ALL', label: 'All' },
  { id: 'lecture_note', label: 'Lecture Notes' },
  { id: 'handout', label: 'Handouts' },
  { id: 'past_question', label: 'Past Questions' },
  { id: 'tutorial', label: 'Tutorials' },
];

export const CampusFeedPage: React.FC<CampusFeedPageProps> = ({
  posts: initialPosts,
  currentInstitution,
  userProfile,
  onSelectMaterialToRead,
  onOpenAuth,
  isLoggedIn = false,
}) => {
  const [posts, setPosts] = useState(initialPosts);
  const [category, setCategory] = useState('ALL');
  const [institutionFilter, setInstitutionFilter] = useState('ALL');
  const [query, setQuery] = useState('');
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [uploadCategory, setUploadCategory] = useState<FeedPost['category']>('handout');
  const [price, setPrice] = useState(0);
  const [file, setFile] = useState<File | null>(null);

  const openUpload = () => {
    if (!isLoggedIn) {
      onOpenAuth?.();
      return;
    }
    setUploadError('');
    setShowUpload(true);
  };

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (category !== 'ALL' && post.category !== category) return false;
      if (institutionFilter !== 'ALL' && post.authorInstitution !== institutionFilter) return false;
      if (!q) return true;
      return [
        post.title,
        post.content,
        post.courseCode || '',
        post.authorName,
        post.authorDepartment,
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [posts, category, institutionFilter, query]);

  const handleLike = async (post: FeedPost) => {
    if (!isLoggedIn || !userProfile?.id) {
      onOpenAuth?.();
      return;
    }
    try {
      const result = await togglePostLike(post.id, userProfile.id);
      setPosts((current) => current.map((item) => {
        if (item.id !== post.id) return item;
        const alreadyLiked = item.likedByUserIds.includes(userProfile.id);
        if (result.liked === alreadyLiked) return item;
        return {
          ...item,
          likesCount: Math.max(0, item.likesCount + (result.liked ? 1 : -1)),
          likedByUserIds: result.liked
            ? [...item.likedByUserIds, userProfile.id]
            : item.likedByUserIds.filter((id) => id !== userProfile.id),
        };
      }));
    } catch (error) {
      console.error('Unable to update post like', error);
    }
  };

  const handleComment = async (postId: string) => {
    if (!isLoggedIn || !userProfile?.id) {
      onOpenAuth?.();
      return;
    }
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    try {
      const saved = await addPostComment(postId, userProfile.id, text);
      setPosts((current) => current.map((post) => post.id === postId
        ? {
            ...post,
            comments: [
              ...post.comments,
              {
                id: saved.id,
                authorId: saved.author_id,
                authorName: userProfile.name || 'Student',
                authorInstitution: userProfile.institutionId || 'UNICAL',
                text: saved.body,
                timestamp: 'Just now',
              },
            ],
          }
        : post));
      setCommentInputs((current) => ({ ...current, [postId]: '' }));
      setExpandedComments((current) => ({ ...current, [postId]: true }));
    } catch (error) {
      console.error('Unable to add comment', error);
    }
  };

  const handleShare = async (post: FeedPost) => {
    const shareData = { title: post.title, text: post.content };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard.writeText(`${post.title}\n\n${post.content}`);
    } catch (error) {
      console.error('Share cancelled or unavailable', error);
    }
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userProfile?.id || !title.trim() || !content.trim() || uploading) return;
    setUploading(true);
    setUploadError('');
    try {
      const [institutionId, resolvedCourseId] = await Promise.all([
        resolveInstitutionUuid(userProfile.institutionId || currentInstitution || 'UNICAL'),
        resolveCourseUuid(courseCode.trim()),
      ]);

      const created = await createCampusUpload(userProfile.id, {
        institutionId,
        departmentId: null,
        courseId: resolvedCourseId,
        title: title.trim(),
        content: content.trim(),
        category: uploadCategory,
        price: Number(price) || 0,
        file,
      });

      const newPost: FeedPost = {
        id: created.id,
        authorId: userProfile.id,
        authorName: userProfile.name || 'Student Contributor',
        authorInstitution: userProfile.institutionId || currentInstitution || 'UNICAL',
        authorDepartment: userProfile.department || 'Department',
        authorLevel: userProfile.level || 'Student',
        title: title.trim(),
        content: content.trim(),
        courseCode: courseCode.trim() || undefined,
        category: uploadCategory,
        attachment: file ? {
          name: file.name,
          fileSize: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          fileType: file.type || 'File',
          previewSnippet: 'Submitted for review.',
        } : undefined,
        priceRequested: Number(price) || 0,
        moderatedPrice: 0,
        moderationStatus: 'PENDING_REVIEW',
        moderatorNotes: 'Submitted for moderator review.',
        likesCount: 0,
        likedByUserIds: [],
        comments: [],
        viewsCount: 0,
        createdAt: 'Just now',
      };

      setPosts((current) => [newPost, ...current]);
      setShowUpload(false);
      setTitle('');
      setContent('');
      setCourseCode('');
      setUploadCategory('handout');
      setPrice(0);
      setFile(null);
    } catch (error) {
      console.error('Unable to publish campus post', error);
      setUploadError('Unable to submit this upload. Check the course code and try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="border-b border-slate-200 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-600">Campus Feed</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">What students are sharing</h1>
              <p className="mt-1 text-sm text-slate-500">Notes, handouts, past questions and campus updates.</p>
            </div>
            <button
              type="button"
              onClick={openUpload}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
            >
              <UploadCloud className="h-4 w-4" />
              Upload
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the feed"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-orange-500 focus:bg-white"
              />
            </div>
            <select
              value={institutionFilter}
              onChange={(event) => setInstitutionFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-orange-500"
            >
              <option value="ALL">All schools</option>
              {INSTITUTIONS.filter((item) => item.id !== 'ALL').map((institution) => (
                <option key={institution.id} value={institution.id}>{institution.shortName}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${category === item.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={openUpload}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-orange-200"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-50 text-sm font-bold text-orange-700">
            {userProfile?.name?.charAt(0).toUpperCase() || 'S'}
          </div>
          <span className="text-sm text-slate-500">Share a note, handout, past question or campus update…</span>
        </button>

        <div className="space-y-4">
          {filteredPosts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Nothing matches these filters</p>
              <p className="mt-1 text-xs text-slate-400">Try another course, school or category.</p>
            </div>
          ) : filteredPosts.map((post) => {
            const liked = Boolean(userProfile?.id && post.likedByUserIds.includes(userProfile.id));
            const showComments = Boolean(expandedComments[post.id]);
            return (
              <article key={post.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    {post.authorAvatar ? (
                      <img src={post.authorAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                        {post.authorName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{post.authorName}</span>
                        <span className="text-xs text-slate-400">· {post.createdAt}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span>{post.authorInstitution}</span>
                        <span>·</span>
                        <span>{post.authorDepartment}</span>
                        <span>·</span>
                        <span>{post.authorLevel}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700">{post.category.replace(/_/g, ' ')}</span>
                      {post.courseCode && <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{post.courseCode}</span>}
                    </div>
                    <h2 className="mt-2 text-base font-bold text-slate-900">{post.title}</h2>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-slate-600">{post.content}</p>
                  </div>

                  {post.attachment && (
                    <button
                      type="button"
                      onClick={() => onSelectMaterialToRead?.(post.attachment?.name || post.title)}
                      className="mt-4 flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-orange-200"
                    >
                      <FileText className="h-5 w-5 text-orange-600" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">{post.attachment.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{post.attachment.fileType} · {post.attachment.fileSize}</p>
                      </div>
                      <span className="text-xs font-semibold text-orange-600">Open</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 sm:px-5">
                  <span>{post.likesCount} {post.likesCount === 1 ? 'like' : 'likes'} · {post.comments.length} {post.comments.length === 1 ? 'comment' : 'comments'}</span>
                  {post.viewsCount > 0 && <span>{post.viewsCount} views</span>}
                </div>

                <div className="grid grid-cols-3 border-t border-slate-100">
                  <button type="button" onClick={() => void handleLike(post)} className={`flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${liked ? 'text-orange-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
                    <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} /> Like
                  </button>
                  <button type="button" onClick={() => setExpandedComments((current) => ({ ...current, [post.id]: !current[post.id] }))} className="flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900">
                    <MessageCircle className="h-4 w-4" /> Comment
                  </button>
                  <button type="button" onClick={() => void handleShare(post)} className="flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-900">
                    <Share2 className="h-4 w-4" /> Share
                  </button>
                </div>

                {showComments && (
                  <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
                    {post.comments.length > 0 && (
                      <div className="space-y-2.5">
                        {post.comments.map((comment) => (
                          <div key={comment.id} className="rounded-xl bg-white px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-800">{comment.authorName}</span>
                              <span className="text-[10px] text-slate-400">{comment.timestamp}</span>
                            </div>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{comment.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        value={commentInputs[post.id] || ''}
                        onChange={(event) => setCommentInputs((current) => ({ ...current, [post.id]: event.target.value }))}
                        onKeyDown={(event) => { if (event.key === 'Enter') void handleComment(post.id); }}
                        placeholder="Write a comment"
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-orange-500"
                      />
                      <button type="button" onClick={() => void handleComment(post.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800" aria-label="Send comment">
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowUpload(false); }}>
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Upload to Campus Feed</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">Your upload will enter moderator review.</p>
              </div>
              <button type="button" onClick={() => setShowUpload(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleUpload} className="space-y-4 p-5">
              <input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Title" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:bg-white" />
              <textarea value={content} onChange={(event) => setContent(event.target.value)} required rows={4} placeholder="What are you sharing?" className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-orange-500 focus:bg-white" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input value={courseCode} onChange={(event) => setCourseCode(event.target.value.toUpperCase())} placeholder="Course code" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-orange-500 focus:bg-white" />
                <select value={uploadCategory} onChange={(event) => setUploadCategory(event.target.value as FeedPost['category'])} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-orange-500 focus:bg-white">
                  {categories.filter((item) => item.id !== 'ALL').map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                <input type="number" min="0" value={price} onChange={(event) => setPrice(Number(event.target.value))} placeholder="Reward" className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs outline-none focus:border-orange-500 focus:bg-white" />
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 hover:border-orange-300">
                <FileText className="h-5 w-5 text-slate-400" />
                <span className="min-w-0 flex-1 text-xs text-slate-600">{file ? file.name : 'Attach a file'}</span>
                <span className="text-xs font-semibold text-orange-600">Browse</span>
                <input type="file" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              </label>
              {uploadError && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">{uploadError}</p>}
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowUpload(false)} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="submit" disabled={uploading} className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60">
                  <UploadCloud className="h-4 w-4" />
                  {uploading ? 'Submitting…' : 'Submit upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
