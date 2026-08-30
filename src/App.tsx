import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  InstitutionId,
  StudyMaterial,
  UserProfile,
  FeedPost
} from './types';
import {
  getStoredUserProfile,
  saveUserProfile,
  getStoredMaterials,
  saveMaterials
} from './services/storage';
import { FEED_POSTS } from './data/mockData';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { CampusFeedPage } from './components/CampusFeedPage';
import { MySchoolPage } from './components/MySchoolPage';
import { MyServicesPage } from './components/MyServicesPage';
import { ProfilePage } from './components/ProfilePage';
import { MaterialReaderModal } from './components/MaterialReaderModal';
import { AuthModal } from './components/AuthModal';
import { Footer } from './components/Footer';

export default function App() {
  const [user, setUser] = useState<UserProfile>(getStoredUserProfile);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const saved = localStorage.getItem('edureach_is_logged_in');
    return saved !== null ? saved === 'true' : false;
  });

  const [materials, setMaterials] = useState<StudyMaterial[]>(getStoredMaterials);
  const [feedPosts] = useState<FeedPost[]>(FEED_POSTS);
  const [currentView, setCurrentView] = useState<'landing' | 'feed' | 'my_school' | 'services' | 'profile'>(() => {
    const saved = localStorage.getItem('edureach_is_logged_in');
    return saved === 'true' ? 'feed' : 'landing';
  });
  const [selectedInstitution, setSelectedInstitution] = useState<InstitutionId>(user.institutionId || 'UNICAL');
  const [readingMaterial, setReadingMaterial] = useState<StudyMaterial | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [authModalConfig, setAuthModalConfig] = useState<{
    isOpen: boolean;
    mode: 'login' | 'register';
    message?: string;
  }>({
    isOpen: false,
    mode: 'login'
  });

  useEffect(() => {
    saveUserProfile(user);
  }, [user]);

  useEffect(() => {
    localStorage.setItem('edureach_is_logged_in', String(isLoggedIn));
    if (!isLoggedIn) {
      setCurrentView('landing');
      setReadingMaterial(null);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    saveMaterials(materials);
  }, [materials]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenAuth = (mode: 'login' | 'register' = 'login', message?: string) => {
    setAuthModalConfig({ isOpen: true, mode, message });
  };

  const handleAuthSuccess = (authenticatedUser: UserProfile) => {
    setUser(authenticatedUser);
    setIsLoggedIn(true);
    if (authenticatedUser.institutionId) {
      setSelectedInstitution(authenticatedUser.institutionId);
    }
    setCurrentView('feed');
    showToast(`Welcome back, ${authenticatedUser.name.split(' ')[0]}!`);
  };

  const handleUpdateUser = (updatedFields: Partial<UserProfile>) => {
    setUser(prev => ({ ...prev, ...updatedFields }));
    if (updatedFields.institutionId) {
      setSelectedInstitution(updatedFields.institutionId);
    }
    showToast('Profile details updated & saved successfully!');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentView('landing');
    setReadingMaterial(null);
    showToast('Logged out of student session.');
  };

  const handleNavigateToTab = (tab: 'feed' | 'my_school' | 'services' | 'profile') => {
    if (!isLoggedIn) {
      handleOpenAuth('register', `Create a free student account or sign in to access ${tab === 'my_school' ? 'My School materials' : tab === 'feed' ? 'Campus Student Feed' : tab === 'services' ? 'Campus Services' : 'your student profile'}.`);
      return;
    }

    setCurrentView(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUnlockMaterial = (material: StudyMaterial) => {
    if (!isLoggedIn) {
      handleOpenAuth('register', 'Create a free student account to access study materials.');
      return;
    }

    setUser(prev => ({
      ...prev,
      unlockedMaterialIds: [...new Set([...prev.unlockedMaterialIds, material.id])],
      viewHistory: [...new Set([...(prev.viewHistory || []), material.id])]
    }));
    setReadingMaterial(material);
    showToast(`Opened ${material.courseCode} study package!`);
  };

  const handleToggleOffline = (materialId: string) => {
    if (!isLoggedIn) {
      handleOpenAuth('register', 'Create a free student account to save study packs offline.');
      return;
    }

    const isSaved = user.savedOfflineMaterialIds.includes(materialId);
    if (isSaved) {
      setUser(prev => ({
        ...prev,
        savedOfflineMaterialIds: prev.savedOfflineMaterialIds.filter(id => id !== materialId)
      }));
      showToast('Study pack removed from offline cache.');
    } else {
      setUser(prev => ({
        ...prev,
        savedOfflineMaterialIds: [...prev.savedOfflineMaterialIds, materialId]
      }));
      showToast('Study pack saved offline for zero-data access!');
    }
  };

  const handleReadFeedMaterial = (materialTitle: string) => {
    if (!isLoggedIn) {
      handleOpenAuth('register', 'Create a free student account to access study materials.');
      return;
    }

    const found = materials.find(m => m.title.toLowerCase().includes(materialTitle.toLowerCase()) || materialTitle.toLowerCase().includes(m.courseCode.toLowerCase()));
    if (found) setReadingMaterial(found);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-orange-500 selection:text-white">
      {toastMessage && (
        <div
          onClick={() => setToastMessage(null)}
          className="fixed bottom-20 md:bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 cursor-pointer hover:bg-slate-800 transition-colors"
          title="Click to dismiss alert"
        >
          <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0" />
          <span className="flex-1 pr-1">{toastMessage}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setToastMessage(null); }}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors ml-1"
            title="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        user={isLoggedIn ? user : null}
        isLoggedIn={isLoggedIn}
        selectedInstitution={selectedInstitution}
        setSelectedInstitution={setSelectedInstitution}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
      />

      {currentView === 'landing' && (
        <LandingPage
          isLoggedIn={isLoggedIn}
          onNavigateToTab={handleNavigateToTab}
          onOpenAuth={handleOpenAuth}
        />
      )}

      {currentView !== 'landing' && !isLoggedIn && (
        <main className="flex-1 flex items-center justify-center px-4 py-20">
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <LockIconPlaceholder />
            <h1 className="mt-4 text-xl font-bold text-slate-900">Student account required</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Sign in or create an account to access EduReach Hub resources and student services.</p>
            <button
              type="button"
              onClick={() => handleOpenAuth('register')}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white hover:bg-orange-700"
            >
              Create Free Account
            </button>
          </div>
        </main>
      )}

      {currentView !== 'landing' && isLoggedIn && (
        <main className="flex-1 w-full pb-16">
          {currentView === 'feed' && (
            <CampusFeedPage
              posts={feedPosts}
              currentInstitution={selectedInstitution}
              userProfile={user}
              onSelectMaterialToRead={handleReadFeedMaterial}
              onOpenAuth={handleOpenAuth}
              isLoggedIn={isLoggedIn}
            />
          )}

          {currentView === 'my_school' && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              <MySchoolPage
                user={user}
                materials={materials}
                selectedInstitution={selectedInstitution}
                setSelectedInstitution={setSelectedInstitution}
                onUnlockMaterial={handleUnlockMaterial}
                onReadMaterial={(mat) => setReadingMaterial(mat)}
                onToggleOffline={handleToggleOffline}
                onOpenCBT={(mat) => setReadingMaterial(mat)}
              />
            </div>
          )}

          {currentView === 'services' && <MyServicesPage user={user} />}

          {currentView === 'profile' && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
              <ProfilePage user={user} onUpdateUser={handleUpdateUser} onLogout={handleLogout} />
            </div>
          )}
        </main>
      )}

      <Footer onNavigateToTab={handleNavigateToTab} onOpenAuth={handleOpenAuth} />

      <AuthModal
        isOpen={authModalConfig.isOpen}
        onClose={() => setAuthModalConfig(prev => ({ ...prev, isOpen: false }))}
        onLoginSuccess={handleAuthSuccess}
        initialMode={authModalConfig.mode}
        redirectMessage={authModalConfig.message}
        onContinueAsGuest={() => {
          handleOpenAuth('register', 'Please create an account or sign in to access the student workspace.');
        }}
      />

      {readingMaterial && isLoggedIn && (
        <MaterialReaderModal
          material={readingMaterial}
          user={user}
          isSavedOffline={user.savedOfflineMaterialIds.includes(readingMaterial.id)}
          onToggleOffline={handleToggleOffline}
          onClose={() => setReadingMaterial(null)}
          onUnlock={() => handleUnlockMaterial(readingMaterial)}
        />
      )}
    </div>
  );
}

function LockIconPlaceholder() {
  return <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">🔒</div>;
}
