import React, { useEffect, useMemo, useState } from 'react';
import { StudyMaterial, UserProfile, InstitutionId } from './types';
import { getStoredUserProfile, getStoredMaterials, saveMaterials } from './services/storage';
import { FEED_POSTS, INSTITUTIONS } from './data/mockData';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { CampusFeedPage } from './components/CampusFeedPage';
import { MySchoolPage } from './components/MySchoolPage';
import { MyServicesPage } from './components/MyServicesPage';
import { ProfilePage } from './components/ProfilePage';
import { MaterialReaderModal } from './components/MaterialReaderModal';
import { AuthModal } from './components/AuthModal';
import { Footer } from './components/Footer';
import { getCurrentUserProfile, subscribeToAuthChanges, signOut } from './lib/auth';
import { isSupabaseConfigured } from './lib/supabase';
import { updateMyProfile } from './lib/dataService';

type View = 'landing' | 'feed' | 'my_school' | 'services' | 'profile';

export default function App() {
  const [user, setUser] = useState<UserProfile>(getStoredUserProfile);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<View>('landing');
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [materials, setMaterials] = useState<StudyMaterial[]>(getStoredMaterials);
  const [readerMaterial, setReaderMaterial] = useState<StudyMaterial | null>(null);
  const [, setSearchQuery] = useState('');

  const initialInstitution = useMemo<InstitutionId>(() => {
    const school = (user.school || '').toLowerCase();
    const match = INSTITUTIONS.find(
      (institution) =>
        school.includes(institution.shortName.toLowerCase()) ||
        school.includes(institution.name.toLowerCase()),
    );
    return match?.id ?? 'ALL';
  }, [user.school]);

  const [selectedInstitution, setSelectedInstitution] = useState<InstitutionId>(initialInstitution);

  useEffect(() => {
    setSelectedInstitution(initialInstitution);
  }, [initialInstitution]);

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
        if (profile) setUser(profile);
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
      if (profile) setUser(profile);
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
    }
  };

  const handleLogin = (profile: UserProfile) => {
    setUser(profile);
    setIsAuthenticated(true);
    setShowAuth(false);
    setView('feed');
  };

  const handleProfileUpdate = async (updates: Partial<UserProfile>) => {
    if (!user.id || !isSupabaseConfigured) return;

    const dbUpdates: Parameters<typeof updateMyProfile>[1] = {};
    if (updates.name !== undefined) dbUpdates.full_name = updates.name;
    if (updates.department !== undefined) dbUpdates.department = updates.department;
    if (updates.faculty !== undefined) dbUpdates.faculty = updates.faculty;
    if (updates.level !== undefined) dbUpdates.level = updates.level;
    if (updates.matricNumber !== undefined) dbUpdates.matric_number = updates.matricNumber;

    try {
      if (Object.keys(dbUpdates).length) {
        await updateMyProfile(user.id, dbUpdates);
        const refreshed = await getCurrentUserProfile();
        if (refreshed) {
          setUser(refreshed);
          return;
        }
      }
      setUser((current) => ({ ...current, ...updates }));
    } catch (error) {
      console.error('Profile update failed', error);
    }
  };

  const handleToggleOffline = (materialId: string) => {
    setUser((current) => {
      const saved = current.savedOfflineMaterialIds ?? [];
      const nextSaved = saved.includes(materialId)
        ? saved.filter((id) => id !== materialId)
        : [...saved, materialId];
      return { ...current, savedOfflineMaterialIds: nextSaved };
    });
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
        {view === 'feed' && isAuthenticated && <CampusFeedPage user={user} posts={FEED_POSTS} />}
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
        {view === 'services' && isAuthenticated && <MyServicesPage user={user} />}
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
          onClose={() => setReaderMaterial(null)}
        />
      )}
    </div>
  );
}
