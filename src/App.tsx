import React, { useEffect, useMemo, useState } from 'react';
import { StudyMaterial, UserProfile, InstitutionId, FeedPost, MaterialNote } from './types';
import { getStoredUserProfile, getStoredMaterials, saveMaterials } from './services/storage';
import { FEED_POSTS, STUDY_MATERIALS } from './data/mockData';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { CampusFeedPage } from './components/CampusFeedPage';
import { MySchoolPage } from './components/MySchoolPage';
import { MyServicesPage } from './components/MyServicesPage';
import { ServiceRequestHistory } from './components/ServiceRequestHistory';
import { ProfilePage } from './components/ProfilePage';
import { MaterialReaderModal } from './components/MaterialReaderModal';
import { AuthModal } from './components/AuthModal';
import { Footer } from './components/Footer';
import { getCurrentUserProfile, subscribeToAuthChanges, signOut } from './lib/auth';
import { isSupabaseConfigured, isValidUuid } from './lib/supabase';
import { getMyAcademicMaterials, getMyProfile, getCampusFeedPosts, getSignedResourceUrl, updateMyProfile } from './lib/dataService';
import { listBookmarks, listMaterialNotesFromBackend, toggleBookmark, type BookmarkEntity } from './lib/userFeatures';

type View = 'landing' | 'feed' | 'my_school' | 'services' | 'profile';

const GUEST_PROFILE: UserProfile = {
  id: '',
  name: 'Guest Student',
  email: '',
  phoneNumber: '',
  institutionId: 'UNICAL',
  department: 'Computer Science',
  faculty: 'Physical Sciences',
  level: '300L',
  walletBalance: 0,
  isAPlusSubscriber: false,
  enrolledCourses: ['CSC 311', 'CSC 321', 'MTH 301'],
  unlockedMaterialIds: [],
  savedOfflineMaterialIds: [],
  materialNotes: [],
  viewHistory: [],
  downloadHistory: [],
  contributorStats: {
    totalEarned: 0,
    totalRoyaltyPaid: 0,
    materialsUploaded: 0,
    pendingPayout: 0,
  },
  role: 'student',
};

export default function App() {
  const [user, setUser] = useState<UserProfile>(getStoredUserProfile);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuestPreview, setIsGuestPreview] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [view, setView] = useState<View>('landing');
  const [pendingTargetView, setPendingTargetView] = useState<View>('feed');
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authMessage, setAuthMessage] = useState('');
  const [materials, setMaterials] = useState<StudyMaterial[]>(getStoredMaterials);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>(FEED_POSTS);
  const [readerMaterial, setReaderMaterial] = useState<StudyMaterial | null>(null);
  const [, setSearchQuery] = useState('');

  const hasAppAccess = isAuthenticated || isGuestPreview;

  const initialInstitution = useMemo<InstitutionId>(() => {
    if (user.institutionId && user.institutionId !== 'ALL') return user.institutionId;
    return 'ALL';
  }, [user.institutionId]);

  const [selectedInstitution, setSelectedInstitution] = useState<InstitutionId>(initialInstitution);

  useEffect(() => {
    setSelectedInstitution(initialInstitution);
  }, [initialInstitution]);

  const loadLiveStudentData = async (profile: UserProfile) => {
    if (!isSupabaseConfigured || !profile.id) return;
    setDataLoading(true);
    try {
      if (!isValidUuid(profile.id)) {
        setFeedPosts([]);
        setMaterials([]);
        setUser((current) => ({ ...current, savedOfflineMaterialIds: [] }));
        return;
      }

      const [dbProfile, liveFeed] = await Promise.all([
        getMyProfile(profile.id),
        getCampusFeedPosts().catch((error) => {
          console.error('Campus feed load failed', error);
          return [] as FeedPost[];
        }),
      ]);

      if (dbProfile) {
        const liveMaterials = await getMyAcademicMaterials(dbProfile).catch((error) => {
          console.error('Academic resource load failed', error);
          return [] as StudyMaterial[];
        });
        setMaterials(liveMaterials);

        try {
          const [resourceBookmarks, pastQuestionBookmarks, backendNotes] = await Promise.all([
            listBookmarks(profile.id, 'resource'),
            listBookmarks(profile.id, 'past_question'),
            listMaterialNotesFromBackend(profile.id),
          ]);
          const liveMaterialIds = new Set(liveMaterials.map((material) => material.id));
          const savedMaterialIds = [...resourceBookmarks, ...pastQuestionBookmarks]
            .map((bookmark) => bookmark.entity_id)
            .filter((id) => liveMaterialIds.has(id));
          const materialNotes: MaterialNote[] = backendNotes.map((note) => ({
            id: note.id,
            materialId: note.material_id,
            courseCode: note.course_code,
            materialTitle: note.material_title,
            content: note.content,
            createdAt: note.created_at,
            updatedAt: note.updated_at,
          }));
          setUser((current) => ({
            ...current,
            savedOfflineMaterialIds: [...new Set(savedMaterialIds)],
            materialNotes,
          }));
        } catch (error) {
          console.error('Student feature hydration failed', error);
        }
      } else {
        setMaterials([]);
        setUser((current) => ({ ...current, savedOfflineMaterialIds: [], materialNotes: [] }));
      }
      setFeedPosts(liveFeed);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;
    const hydrate = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (!mounted) return;
        setIsAuthenticated(Boolean(profile));
        if (profile) {
          setIsGuestPreview(false);
          setUser(profile);
          await loadLiveStudentData(profile);
        }
      } catch (error) {
        console.error('Unable to restore Supabase session', error);
        if (mounted) setIsAuthenticated(false);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    hydrate();
    const subscription = subscribeToAuthChanges(async (session) => {
      if (!mounted) return;
      if (!session) {
        setIsAuthenticated(false);
        setAuthLoading(false);
        if (!isGuestPreview) setView('landing');
        return;
      }
      const profile = await getCurrentUserProfile();
      if (!mounted) return;
      setIsAuthenticated(Boolean(profile));
      setIsGuestPreview(false);
      if (profile) {
        setUser(profile);
        await loadLiveStudentData(profile);
      }
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.data.subscription.unsubscribe();
    };
  }, [isGuestPreview]);

  useEffect(() => {
    if (!isGuestPreview) saveMaterials(materials);
  }, [materials, isGuestPreview]);

  const handleGuestLogin = () => {
    setIsGuestPreview(true);
    setIsAuthenticated(false);
    setUser({ ...GUEST_PROFILE });
    setMaterials(getStoredMaterials().length ? getStoredMaterials() : STUDY_MATERIALS);
    setFeedPosts([...FEED_POSTS]);
    setReaderMaterial(null);
    setView('feed');
    setAuthMessage('');
    setShowAuth(false);
  };

  const handleLogout = async () => {
    try {
      if (isAuthenticated && isSupabaseConfigured) await signOut();
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      setIsAuthenticated(false);
      setIsGuestPreview(false);
      setView('landing');
      setMaterials([]);
      setFeedPosts([]);
      setReaderMaterial(null);
      setUser((current) => ({ ...current, savedOfflineMaterialIds: [], materialNotes: [] }));
    }
  };

  const handleLogin = async (profile: UserProfile) => {
    setUser(profile);
    setIsAuthenticated(true);
    setIsGuestPreview(false);
    setShowAuth(false);
    setView(pendingTargetView || 'feed');
    await loadLiveStudentData(profile);
    setAuthMessage('');
  };

  const handleProfileUpdate = async (updates: Partial<UserProfile>) => {
    if (!user.id || !isValidUuid(user.id) || !isSupabaseConfigured) {
      setUser((current) => ({ ...current, ...updates }));
      return;
    }
    const dbUpdates: Parameters<typeof updateMyProfile>[1] = {};
    if (updates.name !== undefined) dbUpdates.full_name = updates.name;
    if (updates.department !== undefined) dbUpdates.department = updates.department;
    if (updates.faculty !== undefined) dbUpdates.faculty = updates.faculty;
    if (updates.level !== undefined) dbUpdates.level = updates.level;
    try {
      if (Object.keys(dbUpdates).length) {
        await updateMyProfile(user.id, dbUpdates);
        const refreshed = await getCurrentUserProfile();
        if (refreshed) {
          setUser(refreshed);
          await loadLiveStudentData(refreshed);
          return;
        }
      }
      setUser((current) => ({ ...current, ...updates }));
    } catch (error) {
      console.error('Profile update failed', error);
    }
  };

  const handleToggleOffline = async (materialId: string) => {
    const material = materials.find((item) => item.id === materialId) ?? readerMaterial;
    const entityType: BookmarkEntity = material?.materialType === 'past_question' ? 'past_question' : 'resource';
    const wasSaved = user.savedOfflineMaterialIds.includes(materialId);

    setUser((current) => {
      const saved = current.savedOfflineMaterialIds ?? [];
      const nextSaved = saved.includes(materialId)
        ? saved.filter((id) => id !== materialId)
        : [...saved, materialId];
      return { ...current, savedOfflineMaterialIds: nextSaved };
    });

    if (!isSupabaseConfigured || !user.id || !isValidUuid(user.id)) return;
    try {
      const isSaved = await toggleBookmark(user.id, entityType, materialId);
      if (isSaved !== !wasSaved) {
        setUser((current) => {
          const saved = current.savedOfflineMaterialIds ?? [];
          if (isSaved && !saved.includes(materialId)) return { ...current, savedOfflineMaterialIds: [...saved, materialId] };
          if (!isSaved && saved.includes(materialId)) return { ...current, savedOfflineMaterialIds: saved.filter((id) => id !== materialId) };
          return current;
        });
      }
    } catch (error) {
      console.error('Bookmark update failed', error);
      setUser((current) => {
        const saved = current.savedOfflineMaterialIds ?? [];
        const restored = wasSaved
          ? (saved.includes(materialId) ? saved : [...saved, materialId])
          : saved.filter((id) => id !== materialId);
        return { ...current, savedOfflineMaterialIds: restored };
      });
    }
  };

  const handleReadMaterial = async (material: StudyMaterial) => {
    if (!hasAppAccess) {
      setPendingTargetView('my_school');
      setAuthMode('login');
      setAuthMessage('Sign in to access your school materials.');
      setShowAuth(true);
      return;
    }

    if (isGuestPreview) {
      setReaderMaterial(material);
      return;
    }

    try {
      if (material.storagePath) {
        const signedUrl = await getSignedResourceUrl(material.storagePath);
        window.open(signedUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      if (material.externalUrl || material.fileUrl) {
        window.open(material.externalUrl || material.fileUrl || '', '_blank', 'noopener,noreferrer');
        return;
      }
    } catch (error) {
      console.error('Protected material open failed', error);
    }
    setReaderMaterial(material);
  };

  const requireAuth = (nextView: View = 'feed', mode: 'login' | 'signup' = 'login', message?: string) => {
    if (!hasAppAccess) {
      setPendingTargetView(nextView);
      setAuthMode(mode);
      setAuthMessage(message || '');
      setShowAuth(true);
      return;
    }
    setView(nextView);
  };

  if (authLoading) {
    return <div className="min-h-screen bg-white flex items-center justify-center px-6 text-sm text-slate-600">Loading EduReach Hub...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden">
      {hasAppAccess && (
        <Navbar
          user={user}
          currentView={view}
          onNavigate={(nextView) => { setView(nextView); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          onLogout={handleLogout}
          onSearch={setSearchQuery}
        />
      )}

      {isGuestPreview && (
        <div className="sticky top-16 z-30 border-b border-cyan-200 bg-cyan-50/95 backdrop-blur px-3 py-2 text-center text-[11px] sm:text-xs font-semibold text-cyan-900">
          Guest Preview · Mock data · Account actions are disabled
        </div>
      )}

      <main key={view} className={hasAppAccess ? 'er-page animate-fadeIn' : 'animate-fadeIn'}>
        {view === 'landing' && (
          <LandingPage
            isLoggedIn={isAuthenticated}
            onGetStarted={() => requireAuth('feed', 'signup')}
            onNavigate={(target) => requireAuth(target)}
            onNavigateToTab={(tab) => requireAuth(tab)}
            onOpenAuth={(mode, message) => requireAuth('feed', mode === 'register' ? 'signup' : 'login', message)}
            onOpenDemoCBT={() => requireAuth('my_school', 'login', 'Sign in to access CBT practice and your school materials.')}
          />
        )}
        {view === 'feed' && hasAppAccess && (
          <CampusFeedPage
            posts={feedPosts}
            currentInstitution={selectedInstitution}
            userProfile={{ id: user.id, name: user.name, department: user.department, level: user.level, institutionId: user.institutionId }}
            onOpenAuth={() => { setAuthMode('login'); setShowAuth(true); }}
            isLoggedIn={hasAppAccess}
            onSelectMaterialToRead={() => setView('my_school')}
          />
        )}
        {view === 'my_school' && hasAppAccess && (
          <MySchoolPage
            user={user}
            materials={materials}
            selectedInstitution={selectedInstitution}
            setSelectedInstitution={setSelectedInstitution}
            onUnlockMaterial={setReaderMaterial}
            onReadMaterial={handleReadMaterial}
            onToggleOffline={handleToggleOffline}
            onOpenCBT={handleReadMaterial}
          />
        )}
        {view === 'services' && hasAppAccess && (
          <div className="er-content space-y-4 sm:space-y-6">
            <MyServicesPage user={user} />
            <ServiceRequestHistory user={isGuestPreview ? undefined : user} />
          </div>
        )}
        {view === 'profile' && hasAppAccess && (
          <div className="er-content">
            <ProfilePage user={user} onUpdateUser={handleProfileUpdate} onLogout={handleLogout} />
          </div>
        )}
      </main>

      {!hasAppAccess && (
        <Footer
          onOpenAuth={(mode) => {
            setAuthMode(mode === 'register' ? 'signup' : 'login');
            setShowAuth(true);
          }}
          onNavigateToTab={(tab) => requireAuth(tab)}
        />
      )}

      {showAuth && (
        <AuthModal
          isOpen={true}
          mode={authMode}
          redirectMessage={authMessage}
          onClose={() => setShowAuth(false)}
          onLogin={handleLogin}
          onLoginSuccess={handleLogin}
          onGuestLogin={handleGuestLogin}
          onSwitchMode={setAuthMode}
        />
      )}

      {readerMaterial && hasAppAccess && (
        <MaterialReaderModal
          material={readerMaterial}
          user={user}
          isSavedOffline={user.savedOfflineMaterialIds.includes(readerMaterial.id)}
          onToggleOffline={handleToggleOffline}
          onClose={() => setReaderMaterial(null)}
          onUpdateUser={handleProfileUpdate}
        />
      )}

      {dataLoading && isAuthenticated && (
        <div className="er-cta fixed bottom-4 right-4 z-50 rounded-2xl bg-white/95 backdrop-blur border border-slate-200 px-4 py-2.5 text-xs font-medium text-slate-600 shadow-xl">
          Syncing your school data…
        </div>
      )}
    </div>
  );
}
