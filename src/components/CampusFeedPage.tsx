import React, { useState } from 'react';
import { FeedPost, InstitutionId, StudyMaterial } from '../types';
import { INSTITUTIONS } from '../data/mockData';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  FileText, 
  UploadCloud, 
  ShieldCheck, 
  CheckCircle2, 
  Filter, 
  Search, 
  Sparkles, 
  BookOpen, 
  Clock, 
  Building2, 
  Coins, 
  SlidersHorizontal,
  Send,
  Eye,
  Check,
  Award
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

export const CampusFeedPage: React.FC<CampusFeedPageProps> = ({
  posts: initialPosts,
  currentInstitution,
  userProfile,
  onSelectMaterialToRead,
  onOpenAuth,
  isLoggedIn = false,
}) => {
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedInstFilter, setSelectedInstFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Post Creator Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCategory, setNewCategory] = useState<FeedPost['category']>('handout');
  const [newInstitution, setNewInstitution] = useState<InstitutionId>(userProfile?.institutionId || currentInstitution || 'UNICAL');
  const [newDepartment, setNewDepartment] = useState(userProfile?.department || 'Computer Science');
  const [newLevel, setNewLevel] = useState(userProfile?.level || '300L');
  const [newPrice, setNewPrice] = useState<number>(300);
  const [newFileName, setNewFileName] = useState('My_Course_Summary_2025.pdf');

  // Comment input state per post
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({
    'POST-001': true,
  });

  // Moderator Mode preview toggle
  const [isModeratorMode, setIsModeratorMode] = useState(false);
  const [regulatedPriceDrafts, setRegulatedPriceDrafts] = useState<Record<string, number>>({});

  // Handle Like
  const handleLikePost = (postId: string) => {
    if (!isLoggedIn && onOpenAuth) {
      onOpenAuth();
      return;
    }
    const currentUserId = userProfile?.id || 'usr_guest_demo';
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        const alreadyLiked = post.likedByUserIds.includes(currentUserId);
        const newLikes = alreadyLiked ? post.likesCount - 1 : post.likesCount + 1;
        const newLikedUsers = alreadyLiked
          ? post.likedByUserIds.filter((id) => id !== currentUserId)
          : [...post.likedByUserIds, currentUserId];
        return {
          ...post,
          likesCount: Math.max(0, newLikes),
          likedByUserIds: newLikedUsers,
        };
      })
    );
  };

  // Handle Add Comment
  const handleAddComment = (postId: string) => {
    if (!isLoggedIn && onOpenAuth) {
      onOpenAuth();
      return;
    }
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const newComment = {
      id: `c_${Date.now()}`,
      authorId: userProfile?.id || 'usr_guest_demo',
      authorName: userProfile?.name || 'Verified Scholar',
      authorInstitution: userProfile?.institutionId || 'UNICAL',
      text,
      timestamp: 'Just now',
    };

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id !== postId) return post;
        return {
          ...post,
          comments: [...post.comments, newComment],
        };
      })
    );

    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    setExpandedComments((prev) => ({ ...prev, [postId]: true }));
  };

  // Handle New Post Submit
  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    // Moderator automatic fair calculation: capped/reviewed
    const fairRegulatedPrice = Math.min(newPrice, Math.max(0, Math.round(newPrice * 0.85)));

    const created: FeedPost = {
      id: `POST-${Date.now()}`,
      authorId: userProfile?.id || 'usr_current_user',
      authorName: userProfile?.name || 'Academic Scholar',
      authorAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      authorBadge: 'Student Contributor',
      authorInstitution: newInstitution,
      authorDepartment: newDepartment,
      authorLevel: newLevel,
      title: newTitle,
      content: newContent,
      courseCode: newCourseCode.trim() || 'GEN 101',
      category: newCategory,
      attachment: {
        name: newFileName,
        fileSize: '2.4 MB',
        fileType: 'PDF Document',
        pagesCount: 22,
        previewSnippet: 'Uploaded student resource verified with standard university course curriculum.',
      },
      priceRequested: Number(newPrice) || 0,
      moderatedPrice: fairRegulatedPrice,
      moderationStatus: 'APPROVED',
      verifiedByModerator: 'Senate Resource Moderator Desk',
      moderatorNotes: `Reviewed and approved under Student Fair Royalty Policy. Regulated at ₦${fairRegulatedPrice}.`,
      likesCount: 1,
      likedByUserIds: [userProfile?.id || 'usr_current_user'],
      comments: [],
      viewsCount: 1,
      createdAt: 'Just now',
    };

    setPosts([created, ...posts]);
    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewContent('');
    setNewCourseCode('');
  };

  // Moderator regulate action
  const handleApproveRegulation = (postId: string) => {
    const customPrice = regulatedPriceDrafts[postId];
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        return {
          ...p,
          moderationStatus: 'APPROVED',
          moderatedPrice: customPrice !== undefined ? customPrice : p.moderatedPrice,
          verifiedByModerator: 'Verified Senate Moderator',
          moderatorNotes: `Price regulated to ₦${customPrice !== undefined ? customPrice : p.moderatedPrice} after content verification.`,
        };
      })
    );
  };

  // Filtering
  const filteredPosts = posts.filter((post) => {
    if (selectedCategory !== 'ALL' && post.category !== selectedCategory) return false;
    if (selectedInstFilter !== 'ALL' && post.authorInstitution !== selectedInstFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        post.title.toLowerCase().includes(q) ||
        post.content.toLowerCase().includes(q) ||
        post.courseCode?.toLowerCase().includes(q) ||
        post.authorDepartment.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-semibold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                Live Campus Network
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Student Resource Feed
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-xl">
                Browse, read, and share lecture notes, PDFs, handouts, and past questions uploaded by verified scholars across Nigerian campuses.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  if (!isLoggedIn && onOpenAuth) {
                    onOpenAuth();
                  } else {
                    setIsCreateModalOpen(true);
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm shadow-md shadow-orange-600/20 transition-all hover:translate-y-px"
              >
                <UploadCloud className="w-4 h-4" />
                Upload Material
              </button>
            </div>
          </div>
        </div>

        {/* Search & Category Filter Pills */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by course code (e.g. CSC 301, GST 111), topic, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
              {[
                { id: 'ALL', label: 'All Resources' },
                { id: 'handout', label: 'Handouts' },
                { id: 'lecture_note', label: 'Lecture Notes' },
                { id: 'past_question', label: 'Past Questions' },
                { id: 'tutorial', label: 'Tutorial Guides' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedCategory === cat.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* University Selector */}
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedInstFilter}
                onChange={(e) => setSelectedInstFilter(e.target.value)}
                className="text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 cursor-pointer"
              >
                <option value="ALL">All Nigerian Universities</option>
                {INSTITUTIONS.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.shortName} - {inst.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quick Post Prompt Card (Facebook style) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 font-bold flex items-center justify-center shrink-0">
            {userProfile?.name ? userProfile.name[0] : '🎓'}
          </div>
          <button
            onClick={() => {
              if (!isLoggedIn && onOpenAuth) {
                onOpenAuth();
              } else {
                setIsCreateModalOpen(true);
              }
            }}
            className="flex-1 text-left px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-sm transition-colors"
          >
            Have lecture notes, PDFs, or solved questions? Upload & earn cash rewards...
          </button>
          <button
            onClick={() => {
              if (!isLoggedIn && onOpenAuth) {
                onOpenAuth();
              } else {
                setIsCreateModalOpen(true);
              }
            }}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-50 text-orange-700 hover:bg-orange-100 text-xs font-semibold transition-colors"
          >
            <FileText className="w-4 h-4" />
            Add PDF
          </button>
        </div>

        {/* Posts Feed */}
        <div className="space-y-5">
          {filteredPosts.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-800">No resources found in this filter</h3>
              <p className="text-sm text-slate-500 mt-1">Try resetting the category filter or upload the first resource for this course.</p>
              <button
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSelectedInstFilter('ALL');
                  setSearchQuery('');
                }}
                className="mt-4 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredPosts.map((post) => {
              const isLiked = post.likedByUserIds.includes(userProfile?.id || 'usr_guest_demo');
              const isCommentsOpen = !!expandedComments[post.id];

              return (
                <article
                  key={post.id}
                  className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4 hover:border-slate-300 transition-all"
                >
                  {/* Post Header: Author info */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={post.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                        alt={post.authorName}
                        className="w-11 h-11 rounded-full object-cover border border-slate-200"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-slate-900 text-sm sm:text-base leading-tight">
                            {post.authorName}
                          </h4>
                          {post.authorBadge && (
                            <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[10px] font-bold uppercase tracking-wider">
                              {post.authorBadge}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-slate-700">{post.authorInstitution}</span>
                          <span>•</span>
                          <span>{post.authorDepartment}</span>
                          <span>({post.authorLevel})</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {post.createdAt}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Course Code Chip */}
                    {post.courseCode && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono text-xs font-bold shrink-0 shadow-2xs">
                        {post.courseCode}
                      </span>
                    )}
                  </div>

                  {/* Post Title & Text Content */}
                  <div className="space-y-2">
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {post.title}
                    </h3>
                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                      {post.content}
                    </p>
                  </div>

                  {/* Attachment Card */}
                  {post.attachment && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0 shadow-2xs">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                            {post.attachment.name}
                            <span className="text-xs font-normal text-slate-500">
                              ({post.attachment.fileSize} • {post.attachment.pagesCount || 20} pages)
                            </span>
                          </div>
                          {post.attachment.previewSnippet && (
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                              {post.attachment.previewSnippet}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (onSelectMaterialToRead) {
                            onSelectMaterialToRead(post.title);
                          }
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shrink-0 shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview / Read
                      </button>
                    </div>
                  )}

                  {/* Moderator Pricing Regulation Box */}
                  <div className="bg-orange-50/60 border border-orange-200/80 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-bold text-slate-900">
                          {post.moderatedPrice === 0 ? 'Free Open Student Access' : `Regulated Royalty: ₦${post.moderatedPrice}`}
                        </span>
                        <span className="text-slate-500 ml-1.5">
                          (Student requested: ₦{post.priceRequested})
                        </span>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {post.moderatorNotes || 'Vetted for academic integrity and priced under student subsidy limits.'}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold text-[11px] self-start sm:self-auto shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      Senate Approved
                    </span>
                  </div>

                  {/* Engagement Bar (Like, Comment, Share) */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 sm:gap-4">
                      {/* Like Button */}
                      <button
                        onClick={() => handleLikePost(post.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                          isLiked
                            ? 'bg-rose-50 text-rose-600'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isLiked ? 'fill-rose-600 text-rose-600' : ''}`} />
                        <span>{post.likesCount} Likes</span>
                      </button>

                      {/* Comments Toggle Button */}
                      <button
                        onClick={() =>
                          setExpandedComments((prev) => ({
                            ...prev,
                            [post.id]: !prev[post.id],
                          }))
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-semibold transition-all"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{post.comments.length} Comments</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <span>{post.viewsCount} reads</span>
                    </div>
                  </div>

                  {/* Comments Section */}
                  {isCommentsOpen && (
                    <div className="pt-3 border-t border-slate-100 space-y-3 animate-in fade-in duration-150">
                      {post.comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="bg-slate-50 rounded-xl p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">
                              {comment.authorName}{' '}
                              <span className="font-normal text-slate-500 text-[10px]">
                                ({comment.authorInstitution})
                              </span>
                            </span>
                            <span className="text-slate-400 text-[10px]">{comment.timestamp}</span>
                          </div>
                          <p className="text-slate-700 leading-relaxed">{comment.text}</p>
                        </div>
                      ))}

                      {/* Comment Input */}
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Write a comment or ask a question..."
                          value={commentInputs[post.id] || ''}
                          onChange={(e) =>
                            setCommentInputs((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddComment(post.id);
                            }
                          }}
                          className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                        <button
                          onClick={() => handleAddComment(post.id)}
                          className="p-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white transition-colors"
                          title="Send comment"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>

      {/* Upload Material Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 my-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <UploadCloud className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Upload Study Resource</h3>
                  <p className="text-xs text-slate-500">Share lecture notes & earn cash royalties</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-3.5">
              {/* Resource Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Resource Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MTH 201: Differential Equations Complete Solved Handout"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>

              {/* Course Code & Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CSC 301 / GST 111"
                    value={newCourseCode}
                    onChange={(e) => setNewCourseCode(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Resource Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as FeedPost['category'])}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    <option value="handout">Handout & Study Pack</option>
                    <option value="lecture_note">Lecture Notes & Summary</option>
                    <option value="past_question">Past Questions & Solutions</option>
                    <option value="tutorial">Step-by-step Tutorial</option>
                    <option value="resource_pdf">General PDF Reference</option>
                  </select>
                </div>
              </div>

              {/* University & Department */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Institution
                  </label>
                  <select
                    value={newInstitution}
                    onChange={(e) => setNewInstitution(e.target.value as InstitutionId)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  >
                    {INSTITUTIONS.map((inst) => (
                      <option key={inst.id} value={inst.id}>{inst.shortName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Department & Level
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Law / Engineering"
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                      className="w-2/3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                    <select
                      value={newLevel}
                      onChange={(e) => setNewLevel(e.target.value)}
                      className="w-1/3 px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    >
                      <option value="100L">100L</option>
                      <option value="200L">200L</option>
                      <option value="300L">300L</option>
                      <option value="400L">400L</option>
                      <option value="500L">500L</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Description / Summary */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Description & Key Topics Covered *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Explain what topics are solved, exam sessions covered, formulas included, and why students should study this..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                />
              </div>

              {/* File Attachment Name & Cash Pricing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Attached File Name
                  </label>
                  <input
                    type="text"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Proposed Cash Reward (₦)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="e.g. 350 (or 0 for Free)"
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Moderator Regulation Disclaimer */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Moderation Policy:</strong> All uploads are reviewed by verified departmental moderators. Moderators regulate the final price to prevent student exploitation while guaranteeing fair payouts to authors.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-xs shadow-md shadow-orange-600/20 transition-all"
                >
                  Publish Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
