import React, { useEffect, useMemo, useState } from 'react';
import { StudyMaterial, UserProfile, InstitutionId, FeedPost } from './types';
import { getStoredUserProfile, getStoredMaterials, saveMaterials } from './services/storage';
import { FEED_POSTS } from './data/mockData';
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
import { isSupabaseConfigured } from './lib/supabase';
import { getMyAcademicMaterials, getMyProfile, getCampusFeedPosts, updateMyProfile } from './lib/dataService';
import { listBookmarks, toggleBookmark, type BookmarkEntity } from './lib/userFeatures';

type View = 'landing' | 'feed' | 'my_school' | 'services' | 'profile';

export default function App() {
  const [user, setUser] = useState<UserProfile>(getStoredUserProfile);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [view, setView] = useState<View>('landing');
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [materials, setMaterials] = useState<StudyMaterial[]>(getStoredMaterials);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>(FEED_POSTS);
  const [readerMaterial, setReaderMaterial] = useState<StudyMaterial | null>(null);
  const [, setSearchQuery] = useState('');

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
          const [resourceBookmarks, pastQuestionBookmarks] = await Promise.all([
            listBookmarks(profile.id, 'resource'),
            listBookmarks(profile.id, 'past_question'),
          ]);
          const liveMaterialIds = new Set(liveMaterials.map((material) => material.id));
          const savedMaterialIds = [...resourceBookmarks, ...pastQuestionBookmarks]
            .map((bookmark) => bookmark.entity_id)
            .filter((id) => liveMaterialIds.has(id));
          setUser((current) => ({ ...current, savedOfflineMaterialIds: [...new Set(savedMaterialIds)] }));
        } catch (error) {
          console.error('Bookmark load failed', error);
        }
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
        setView('landing');
        return;
      }
      const profile = await getCurrentUserProfile();
      if (!mounted) return;
      setIsAuthenticated(Boolean(profile));
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
  }, []);

  useEffect(() => {
    saveMaterials(materials);
  }, [materials]);

  const handleLogout = async () => {
    try {
      if (isSupabaseConfigured) await signOut();
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      setIsAuthenticated(false);
      setView('landing');
      setMaterials([]);
      setFeedPosts([]);
      setUser((current) => ({ ...current, savedOfflineMaterialIds: [] }));
    }
  };

  const handleLogin = async (profile: UserProfile) => {
    setUser(profile);
    setIsAuthenticated(true);
    setShowAuth(false);
    setView('feed');
    await loadLiveStudentData(profile);
  };

  const handleProfileUpdate = async (updates: Partial<UserProfile>) => {
    if (!user.id || !isSupabaseConfigured) return;
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

    if (!isSupabaseConfigured || !user.id) return;
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

  const requireAuth = (nextView: View = 'feed') => {
    if (!isAuthenticated) {
      setAuthMode('login');
      setShowAuth(true);
      return;
    }
    setView(nextView);
  };

  if (authLoading) {
    return <div className="min-h-screen bg-white flex items-center justify-center text-slate-600">Loading EduReach Hub...</div>;
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {isAuthenticated && (
        <Navbar
          user={user}
          currentView={view}
          onNavigate={setView}
          onLogout={handleLogout}
          onSearch={setSearchQuery}
        />
      )}

      <main>
        {view === 'landing' && (
          <LandingPage
            onGetStarted={() => {
              setAuthMode('signup');
              setShowAuth(true);
            }}
            onNavigate={(target) => requireAuth(target)}
          />
        )}
        {view === 'feed' && isAuthenticated && (
          <CampusFeedPage
            posts={feedPosts}
            currentInstitution={selectedInstitution}
            userProfile={{ id: user.id, name: user.name, department: user.department, level: user.level, institutionId: user.institutionId }}
            onOpenAuth={() => { setAuthMode('login'); setShowAuth(true); }}
            isLoggedIn={isAuthenticated}
            onSelectMaterialToRead={() => setView('my_school')}
          />
        )}
        {view === 'my_school' && isAuthenticated && (
          <MySchoolPage
            user={user}
            materials={materials}
            selectedInstitution={selectedInstitution}
            setSelectedInstitution={setSelectedInstitution}
            onUnlockMaterial={setReaderMaterial}
            onReadMaterial={setReaderMaterial}
            onToggleOffline={handleToggleOffline}
            onOpenCBT={setReaderMaterial}
          />
        )}
        {view === 'services' && isAuthenticated && (
          <div className="space-y-6">
            <MyServicesPage user={user} />
            <ServiceRequestHistory user={user} />
          </div>
        )}
        {view === 'profile' && isAuthenticated && (
          <ProfilePage user={user} onUpdateUser={handleProfileUpdate} onLogout={handleLogout} />
        )}
      </main>

      {!isAuthenticated && <Footer />}

      {showAuth && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuth(false)}
          onLogin={handleLogin}
          onSwitchMode={setAuthMode}
        />
      )}

      {readerMaterial && (
        <MaterialReaderModal
          material={readerMaterial}
          user={user}
          isSavedOffline={user.savedOfflineMaterialIds.includes(readerMaterial.id)}
          onToggleOffline={handleToggleOffline}
          onClose={() => setReaderMaterial(null)}
        />
      )}

      {dataLoading && isAuthenticated && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs text-slate-500 shadow-sm">
          Syncing your school data…
        </div>
      )}
    </div>
  );
}
